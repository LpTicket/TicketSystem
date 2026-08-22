import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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

  constructor(private readonly config: ConfigService) {}

  isConfigured() {
    return Boolean(
      this.config.get<string>('ZOHO_CAMPAIGNS_CLIENT_ID')
      && this.config.get<string>('ZOHO_CAMPAIGNS_CLIENT_SECRET')
      && this.config.get<string>('ZOHO_CAMPAIGNS_REFRESH_TOKEN')
      && this.config.get<string>('ZOHO_CAMPAIGNS_FROM_EMAIL'),
    );
  }

  private async accessToken(): Promise<string> {
    const clientId = this.config.get<string>('ZOHO_CAMPAIGNS_CLIENT_ID');
    const clientSecret = this.config.get<string>('ZOHO_CAMPAIGNS_CLIENT_SECRET');
    const refreshToken = this.config.get<string>('ZOHO_CAMPAIGNS_REFRESH_TOKEN');
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

  private async request(path: string, values: Record<string, string>): Promise<any> {
    const token = await this.accessToken();
    const body = new URLSearchParams({ resfmt: 'json', ...values });
    const response = await fetch(`${this.campaignsBase}/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    const payload: any = await response.json().catch(async () => ({ message: await response.text() }));
    const error = payload?.code === '0' ? '' : String(payload?.message || payload?.status || payload?.error || '');
    if (!response.ok || /error|fail/i.test(error)) {
      throw new Error(`ZOHO_CAMPAIGNS_REQUEST_FAILED: ${error || response.status}`);
    }
    return payload;
  }

  private campaignKey(payload: any, type: 'list' | 'campaign'): string {
    const candidates = type === 'list'
      ? [payload?.listkey, payload?.list_key, payload?.list_details?.listkey, payload?.data?.listkey]
      : [payload?.campaignkey, payload?.campaign_key, payload?.campaign_details?.campaignkey, payload?.data?.campaignkey];
    const value = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim());
    if (!value) throw new Error(`ZOHO_CAMPAIGNS_INVALID_${type.toUpperCase()}_RESPONSE`);
    return value;
  }

  private contactPayload(emails: string[]) {
    return JSON.stringify(emails.map((email) => ({ contact_email: email, contact_status: 'active' })));
  }

  async createAndSendCampaign(input: ZohoCampaignInput): Promise<ZohoCampaignCreated> {
    if (!this.isConfigured()) throw new Error('ZOHO_CAMPAIGNS_NOT_CONFIGURED');
    const recipients = Array.from(new Set(input.recipients.map((email) => email.trim().toLowerCase()).filter(Boolean)));
    if (!recipients.length) throw new Error('ZOHO_CAMPAIGNS_EMPTY_AUDIENCE');

    const listName = `LPTicket ${new Date().toISOString().slice(0, 10)} ${input.name}`.slice(0, 100);
    const initial = recipients.slice(0, 10);
    const listResponse = await this.request('addlistandcontacts', {
      listname: listName,
      signupform: 'private',
      mode: 'newlist',
      contactinfo: this.contactPayload(initial),
    });
    const listKey = this.campaignKey(listResponse, 'list');

    for (let index = 10; index < recipients.length; index += 10) {
      await this.request('addlistsubscribersinbulk', {
        listkey: listKey,
        contactinfo: this.contactPayload(recipients.slice(index, index + 10)),
      });
    }

    const campaignResponse = await this.request('createcampaign', {
      campaignname: input.name.slice(0, 100),
      from_email: this.config.get<string>('ZOHO_CAMPAIGNS_FROM_EMAIL') || '',
      from_name: this.config.get<string>('ZOHO_CAMPAIGNS_FROM_NAME') || 'LPTicket',
      subject: input.subject.slice(0, 255),
      content_url: input.contentUrl,
      list_details: JSON.stringify({ [listKey]: [] }),
    });
    const campaignKey = this.campaignKey(campaignResponse, 'campaign');
    await this.request('sendcampaign', { campaignkey: campaignKey });
    return { campaignKey, listKey };
  }
}
