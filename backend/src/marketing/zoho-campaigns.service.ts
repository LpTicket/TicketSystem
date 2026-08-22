import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { MarketingIntegration } from './marketing-integration.entity';

type ZohoCampaignInput = {
  name: string;
  subject: string;
  contentUrl: string;
  recipients: string[];
};

type ZohoCampaignCreated = { campaignKey: string; listKey: string };

/**
 * Isolated adapter for Zoho Campaigns. Marketing email must never fall back to
 * the normal Zoho Mail SMTP account, because that account is not a bulk sender.
 */
@Injectable()
export class ZohoCampaignsService {
  private readonly accountsBase = 'https://accounts.zoho.com';
  private readonly campaignsBase = 'https://campaigns.zoho.com/api/v1.1';
  private readonly redirectUri = 'https://ticketsystembackend.up.railway.app/api/marketing/admin/zoho/callback';

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(MarketingIntegration)
    private readonly integrationRepo: Repository<MarketingIntegration>,
  ) {}

  async isConfigured() {
    return Boolean(
      this.config.get<string>('ZOHO_CAMPAIGNS_CLIENT_ID')
      && this.config.get<string>('ZOHO_CAMPAIGNS_CLIENT_SECRET')
      && this.config.get<string>('ZOHO_CAMPAIGNS_FROM_EMAIL'),
    ) && Boolean(await this.refreshToken());
  }

  private encryptionKey() {
    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret || secret.length < 32) throw new Error('ZOHO_CAMPAIGNS_MISSING_ENCRYPTION_KEY');
    return createHash('sha256').update(secret).digest();
  }

  private encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${encrypted.toString('base64')}`;
  }

  private decrypt(value: string) {
    const [iv, tag, encrypted] = value.split('.');
    if (!iv || !tag || !encrypted) throw new Error('ZOHO_CAMPAIGNS_INVALID_STORED_TOKEN');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8');
  }

  private async refreshToken() {
    const configured = this.config.get<string>('ZOHO_CAMPAIGNS_REFRESH_TOKEN');
    if (configured) return configured;
    const connection = await this.integrationRepo.findOne({ where: { provider: 'zoho-campaigns' } });
    return connection ? this.decrypt(connection.encryptedRefreshToken) : '';
  }

  /** Creates a short-lived signed state so only an authorization initiated by
   * the authenticated admin panel can be accepted by the public callback. */
  private authorizationState() {
    const payload = Buffer.from(JSON.stringify({
      expiresAt: Date.now() + 10 * 60 * 1000,
      nonce: randomBytes(16).toString('hex'),
    })).toString('base64url');
    const signature = createHmac('sha256', this.encryptionKey()).update(payload).digest('base64url');
    return `${payload}.${signature}`;
  }

  private isValidAuthorizationState(state: string) {
    const [payload, signature] = state.split('.');
    if (!payload || !signature) return false;
    const expected = createHmac('sha256', this.encryptionKey()).update(payload).digest('base64url');
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
    try {
      const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      return Number.isFinite(parsed?.expiresAt) && parsed.expiresAt > Date.now();
    } catch {
      return false;
    }
  }

  /** Returns an OAuth consent URL without exposing the client secret or token. */
  getAuthorizationUrl() {
    const clientId = this.config.get<string>('ZOHO_CAMPAIGNS_CLIENT_ID');
    if (!clientId) throw new Error('ZOHO_CAMPAIGNS_NOT_CONFIGURED');
    const url = new URL(`${this.accountsBase}/oauth/v2/auth`);
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: this.redirectUri,
      access_type: 'offline',
      prompt: 'consent',
      scope: 'ZohoCampaigns.contact.CREATE,ZohoCampaigns.campaign.CREATE-UPDATE',
      state: this.authorizationState(),
    }).toString();
    return url.toString();
  }

  /** Called only by the Zoho OAuth redirect. The token is encrypted before it
   * touches persistent storage and is never returned to the browser. */
  async completeAuthorization(code: string, state: string) {
    const clientId = this.config.get<string>('ZOHO_CAMPAIGNS_CLIENT_ID');
    const clientSecret = this.config.get<string>('ZOHO_CAMPAIGNS_CLIENT_SECRET');
    if (!code || !clientId || !clientSecret || !this.isValidAuthorizationState(state)) {
      throw new Error('ZOHO_CAMPAIGNS_AUTHORIZATION_FAILED');
    }
    const response = await fetch(`${this.accountsBase}/oauth/v2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok || !payload.refresh_token) throw new Error('ZOHO_CAMPAIGNS_AUTHORIZATION_FAILED');
    const existing = await this.integrationRepo.findOne({ where: { provider: 'zoho-campaigns' } });
    await this.integrationRepo.save(existing
      ? this.integrationRepo.merge(existing, { encryptedRefreshToken: this.encrypt(payload.refresh_token) })
      : this.integrationRepo.create({ provider: 'zoho-campaigns', encryptedRefreshToken: this.encrypt(payload.refresh_token) }));
  }

  private async accessToken(): Promise<string> {
    const clientId = this.config.get<string>('ZOHO_CAMPAIGNS_CLIENT_ID');
    const clientSecret = this.config.get<string>('ZOHO_CAMPAIGNS_CLIENT_SECRET');
    const refreshToken = await this.refreshToken();
    if (!clientId || !clientSecret || !refreshToken) throw new Error('ZOHO_CAMPAIGNS_NOT_CONFIGURED');

    const body = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    });
    const response = await fetch(`${this.accountsBase}/oauth/v2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const payload: any = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token) {
      throw new Error(`ZOHO_CAMPAIGNS_AUTH_FAILED: ${String(payload.error || payload.error_description || response.status)}`);
    }
    return payload.access_token;
  }

  private async request(path: string, values: Record<string, string>, method: 'GET' | 'POST' = 'POST'): Promise<any> {
    const token = await this.accessToken();
    // Zoho Campaigns v1.1 documents JSON in uppercase. Supplying lowercase can
    // make the API answer in XML, which prevents the returned list key from
    // being recognized even when the provider created the list correctly.
    const body = new URLSearchParams({ resfmt: 'JSON', ...values });
    const requestUrl = new URL(`${this.campaignsBase}/${path}`);
    if (method === 'GET') requestUrl.search = body.toString();
    const response = await fetch(requestUrl, {
      method,
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      ...(method === 'POST' ? { body } : {}),
    });
    // A Fetch response body can be consumed only once. Zoho may respond with
    // HTML/plain text for a provider-side validation error, so read it once and
    // then attempt to decode JSON without hiding that original provider error.
    const rawBody = await response.text();
    let payload: any = {};
    if (rawBody.trim()) {
      try {
        payload = JSON.parse(rawBody);
      } catch {
        payload = { message: rawBody };
      }
    }
    const providerResponse = payload?.response && typeof payload.response === 'object'
      ? payload.response
      : payload;
    const code = String(providerResponse?.code ?? payload?.code ?? '').trim();
    const message = String(
      providerResponse?.message
      || payload?.message
      || providerResponse?.status
      || payload?.status
      || providerResponse?.error
      || payload?.error
      || '',
    ).trim();
    // Zoho documents 0 and 200 as successful values across the v1.1 endpoints.
    // Never treat an unrecognized provider response as a success: it could leave
    // a campaign half-created and make an operator believe the email was sent.
    if (!response.ok || !['0', '200'].includes(code)) {
      throw new Error(`ZOHO_CAMPAIGNS_${path.toUpperCase()}_FAILED: ${code || response.status} ${message || 'Respuesta no reconocida de Zoho.'}`.trim());
    }
    return payload;
  }

  /**
   * Accounts using Zoho's updated topic-management model require a topic when
   * creating a campaign. Prefer an explicit Railway variable; otherwise only
   * read the account's default topic. This request never sends a campaign.
   */
  private async defaultTopicId(): Promise<string> {
    const configured = this.config.get<string>('ZOHO_CAMPAIGNS_TOPIC_ID')?.trim();
    if (configured) return configured;

    try {
      const payload = await this.request('topics', {
        details: JSON.stringify({ from_index: 0, range: 100 }),
      }, 'GET');
      const providerResponse = payload?.response && typeof payload.response === 'object'
        ? payload.response
        : payload;
      const topics = Array.isArray(providerResponse?.topicDetails)
        ? providerResponse.topicDetails
        : Array.isArray(payload?.topicDetails)
          ? payload.topicDetails
          : [];
      const defaultTopic = topics.find((topic: any) => String(topic?.topicName || '').trim().toLowerCase() === 'default');
      return String(defaultTopic?.topicId || '').trim();
    } catch {
      // Topic management is optional on older Zoho accounts. Let createCampaign
      // provide its exact validation error if this account does not expose one.
      return '';
    }
  }

  private campaignKey(payload: any, type: 'list' | 'campaign'): string {
    const response = payload?.response || {};
    const data = payload?.data || {};
    const candidates = type === 'list'
      ? [payload?.listkey, payload?.listKey, payload?.list_details?.listkey, response?.listkey, response?.listKey, data?.listkey, data?.listKey]
      : [payload?.campaignKey, payload?.campaignkey, payload?.campaign_key, payload?.campaign_details?.campaignkey, response?.campaignKey, response?.campaignkey, data?.campaignKey, data?.campaignkey];
    const value = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim());
    if (!value) throw new Error(`ZOHO_CAMPAIGNS_INVALID_${type.toUpperCase()}_RESPONSE`);
    return value;
  }

  private emailIds(emails: string[]) {
    // Zoho Campaigns v1.1 requires `emailids` as a comma-separated list for
    // both list creation and bulk additions (maximum ten per request).
    return emails.join(',');
  }

  async createAndSendCampaign(input: ZohoCampaignInput): Promise<ZohoCampaignCreated> {
    if (!(await this.isConfigured())) throw new Error('ZOHO_CAMPAIGNS_NOT_CONFIGURED');
    const recipients = Array.from(new Set(input.recipients.map((email) => email.trim().toLowerCase()).filter(Boolean)));
    if (!recipients.length) throw new Error('ZOHO_CAMPAIGNS_EMPTY_AUDIENCE');

    // Zoho keeps private lists after a failed campaign setup. Give each attempt
    // a unique name so retrying the same saved campaign never collides with an
    // earlier incomplete list or sends a duplicate audience.
    const attemptKey = `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
    const listName = `LPTicket ${input.name} ${attemptKey}`.slice(0, 100);
    const topicId = await this.defaultTopicId();
    const initial = recipients.slice(0, 10);
    const listResponse = await this.request('addlistandcontacts', {
      listname: listName,
      signupform: 'private',
      mode: 'newlist',
      emailids: this.emailIds(initial),
    });
    const listKey = this.campaignKey(listResponse, 'list');

    for (let index = 10; index < recipients.length; index += 10) {
      await this.request('addlistsubscribersinbulk', {
        listkey: listKey,
        emailids: this.emailIds(recipients.slice(index, index + 10)),
      });
    }

    // Zoho's v1.1 endpoint is case-sensitive: `createcampaign` responds with
    // a misleading HTTP 200 resource-not-found message instead of a campaign.
    const campaignResponse = await this.request('createCampaign', {
      campaignname: input.name.slice(0, 100),
      from_email: this.config.get<string>('ZOHO_CAMPAIGNS_FROM_EMAIL') || '',
      from_name: this.config.get<string>('ZOHO_CAMPAIGNS_FROM_NAME') || 'LPTicket',
      subject: input.subject.slice(0, 255),
      content_url: input.contentUrl,
      // With Zoho's updated topic management, the list itself must be linked
      // to the consent topic. Without it Zoho creates the campaign without a
      // selected audience and rejects sendcampaign with error 6606.
      list_details: JSON.stringify({ [listKey]: topicId ? [topicId] : [] }),
      ...(topicId ? { topicId } : {}),
    });
    const campaignKey = this.campaignKey(campaignResponse, 'campaign');
    await this.request('sendcampaign', { campaignkey: campaignKey });
    return { campaignKey, listKey };
  }
}
