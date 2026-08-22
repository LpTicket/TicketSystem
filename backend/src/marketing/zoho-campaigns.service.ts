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
  // Read access is necessary to verify that Zoho actually associated the
  // private list before `sendcampaign` is ever called. Using ALL scopes keeps
  // the OAuth consent aligned with the documented read/create/update actions.
  private readonly oauthScope = 'ZohoCampaigns.contact.ALL,ZohoCampaigns.campaign.ALL';
  private cachedAccessToken: { value: string; expiresAt: number } | null = null;
  private accessTokenRequest: Promise<string> | null = null;
  private tokenGeneration = 0;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(MarketingIntegration)
    private readonly integrationRepo: Repository<MarketingIntegration>,
  ) {}

  /**
   * Verifies the credentials and the read permission needed to manage a
   * campaign audience. A refresh token merely being stored is not enough: it
   * may have been revoked or lack the contact scope granted by Zoho.
   * This performs no campaign, contact, or list mutation.
   */
  async verifyConnection(): Promise<void> {
    const hasBaseConfiguration = Boolean(
      this.config.get<string>('ZOHO_CAMPAIGNS_CLIENT_ID')
      && this.config.get<string>('ZOHO_CAMPAIGNS_CLIENT_SECRET')
      && this.config.get<string>('ZOHO_CAMPAIGNS_FROM_EMAIL'),
    );
    if (!hasBaseConfiguration) throw new Error('ZOHO_CAMPAIGNS_NOT_CONFIGURED');
    await this.request('getmailinglists', {
      sort: 'desc',
      fromindex: '1',
      range: '1',
    }, 'GET');
  }

  async connectionStatus(): Promise<{ connected: boolean; error?: string }> {
    try {
      await this.verifyConnection();
      return { connected: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'ZOHO_CAMPAIGNS_CONNECTION_FAILED';
      return { connected: false, error: message.slice(0, 500) };
    }
  }

  async isConfigured() {
    try {
      await this.verifyConnection();
      return true;
    } catch {
      return false;
    }
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
    const connection = await this.integrationRepo.findOne({ where: { provider: 'zoho-campaigns' } });
    // An administrator can renew consent from the dashboard. That refreshed
    // token is persisted encrypted in PostgreSQL and must take precedence over
    // a legacy Railway fallback; otherwise a successful reconnect would keep
    // using the old token and fail with the same missing-permission error.
    if (connection) return this.decrypt(connection.encryptedRefreshToken);
    return this.config.get<string>('ZOHO_CAMPAIGNS_REFRESH_TOKEN') || '';
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
      scope: this.oauthScope,
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
    // Consent renewal invalidates any token issued from the previous refresh
    // token. The generation prevents an older in-flight request from restoring
    // a stale token after the administrator reconnects the integration.
    this.tokenGeneration += 1;
    this.cachedAccessToken = null;
    this.accessTokenRequest = null;
  }

  private async accessToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedAccessToken && this.cachedAccessToken.expiresAt - 60_000 > now) {
      return this.cachedAccessToken.value;
    }
    if (this.accessTokenRequest) return this.accessTokenRequest;

    const generation = this.tokenGeneration;
    const pendingRequest = this.requestAccessToken(generation);
    this.accessTokenRequest = pendingRequest;
    try {
      return await pendingRequest;
    } finally {
      if (this.accessTokenRequest === pendingRequest) this.accessTokenRequest = null;
    }
  }

  private async requestAccessToken(generation: number): Promise<string> {
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
      throw new Error(`ZOHO_CAMPAIGNS_AUTH_FAILED: ${String(payload.error_description || payload.error || response.status)}`);
    }
    const accessToken = String(payload.access_token);
    const expiresInSeconds = Number(payload.expires_in);
    const lifetimeMs = (Number.isFinite(expiresInSeconds) && expiresInSeconds > 0 ? expiresInSeconds : 3600) * 1000;
    if (generation === this.tokenGeneration) {
      this.cachedAccessToken = { value: accessToken, expiresAt: Date.now() + lifetimeMs };
    }
    return accessToken;
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

  /**
   * `addlistandcontacts`/bulk list APIs only place an address in a list. They
   * do not associate it with a Topic in Zoho's updated topic model, so the
   * provider rejects the campaign with 6606 even though the list exists.
   *
   * `listsubscribe` is intentionally applied one recipient at a time because
   * it is the documented endpoint that accepts `topic_id`. Private lists do
   * not send an opt-in email from this operation; it only updates the
   * recipient's audience classification before campaign creation.
   */
  private async ensureTopicAudience(listKey: string, recipients: string[], topicId: string) {
    if (!topicId) {
      throw new Error('ZOHO_CAMPAIGNS_MISSING_TOPIC: Configura el tema de marketing antes de preparar la audiencia. No se envió ningún correo.');
    }
    for (const email of recipients) {
      await this.request('json/listsubscribe', {
        listkey: listKey,
        contactinfo: JSON.stringify({ 'Contact Email': email }),
        topic_id: topicId,
        source: 'LPTicket Marketing',
      });
    }
  }

  /**
   * Reuse a previous private list created for this exact audience. Zoho keeps
   * lists after a failed draft, so creating another one on every retry only
   * clutters the account and makes diagnosis harder.
   */
  private async reusableListKey(campaignName: string, recipientCount: number): Promise<string> {
    const payload = await this.request('getmailinglists', {
      sort: 'desc',
      fromindex: '1',
      range: '100',
    }, 'GET');
    const response = payload?.response && typeof payload.response === 'object' ? payload.response : payload;
    const candidateLists = [
      response?.list_of_details?.list,
      response?.list_of_details,
      payload?.list_of_details?.list,
      payload?.list_of_details,
      response?.lists,
      payload?.lists,
    ].find(Array.isArray) || [];
    const prefix = `lpticket ${campaignName}`.toLowerCase();
    const reusable = candidateLists.find((list: any) => {
      const name = String(list?.listname || list?.listName || '').trim().toLowerCase();
      const contacts = Number(list?.noofcontacts ?? list?.contactscount ?? list?.contactsCount);
      return name.startsWith(prefix) && contacts === recipientCount;
    });
    return String(reusable?.listkey || reusable?.listKey || '').trim();
  }

  private associatedListKeys(payload: any): string[] {
    const response = payload?.response && typeof payload.response === 'object' ? payload.response : payload;
    const source = [
      response?.associated_mailing_lists,
      response?.associated_mailing_lists?.list,
      payload?.associated_mailing_lists,
      payload?.associated_mailing_lists?.list,
    ].find(Boolean);
    const lists = Array.isArray(source) ? source : source ? [source] : [];
    return lists
      .map((list: any) => String(list?.listkey || list?.listKey || '').trim())
      .filter(Boolean);
  }

  async createAndSendCampaign(input: ZohoCampaignInput): Promise<ZohoCampaignCreated> {
    // Preserve Zoho's exact safe provider error (for example, a missing list
    // scope) instead of collapsing it into a generic "not configured" state.
    await this.verifyConnection();
    const recipients = Array.from(new Set(input.recipients.map((email) => email.trim().toLowerCase()).filter(Boolean)));
    if (!recipients.length) throw new Error('ZOHO_CAMPAIGNS_EMPTY_AUDIENCE');

    const topicId = await this.defaultTopicId();
    let listKey = '';
    try {
      listKey = await this.reusableListKey(input.name, recipients.length);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      if (!/getmailinglists_failed.*(?:2401|no mailing list)/i.test(message)) throw error;
    }

    if (!listKey) {
      const attemptKey = `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
      const listName = `LPTicket ${input.name} ${attemptKey}`.slice(0, 100);
      const initial = recipients.slice(0, 10);
      const listResponse = await this.request('addlistandcontacts', {
        listname: listName,
        signupform: 'private',
        mode: 'newlist',
        emailids: this.emailIds(initial),
      });
      listKey = this.campaignKey(listResponse, 'list');
    }

    // This also repairs a reusable private list left by an earlier failed
    // attempt: every pending recipient is associated to the configured topic
    // before creating a new Zoho draft. It never sends the campaign itself.
    await this.ensureTopicAudience(listKey, recipients, topicId);

    // Zoho's v1.1 endpoint is case-sensitive: `createcampaign` responds with
    // a misleading HTTP 200 resource-not-found message instead of a campaign.
    const campaignResponse = await this.request('createCampaign', {
      campaignname: input.name.slice(0, 100),
      from_email: this.config.get<string>('ZOHO_CAMPAIGNS_FROM_EMAIL') || '',
      from_name: this.config.get<string>('ZOHO_CAMPAIGNS_FROM_NAME') || 'LPTicket',
      subject: input.subject.slice(0, 255),
      content_url: input.contentUrl,
      // This is the official list-details shape. Topic selection is sent in
      // its own parameter; placing it inside the list value can cause Zoho to
      // silently discard the audience and later return error 6606.
      list_details: JSON.stringify({ [listKey]: [] }),
      ...(topicId ? { topicId } : {}),
    });
    const campaignKey = this.campaignKey(campaignResponse, 'campaign');
    const details = await this.request('getcampaigndetails', {
      campaignkey: campaignKey,
      campaigntype: 'normal',
    }, 'GET');
    if (!this.associatedListKeys(details).includes(listKey)) {
      throw new Error('ZOHO_CAMPAIGNS_AUDIENCE_NOT_ASSOCIATED: Zoho creó el borrador, pero no confirmó la lista privada como audiencia. No se envió ningún correo.');
    }
    await this.request('sendcampaign', { campaignkey: campaignKey });
    return { campaignKey, listKey };
  }
}
