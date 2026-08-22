import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { MarketingIntegration } from './marketing-integration.entity';
import { ZohoCampaignsService } from './zoho-campaigns.service';

describe('ZohoCampaignsService access token reuse', () => {
  let service: ZohoCampaignsService;
  let fetchMock: jest.SpiedFunction<typeof fetch>;
  let tokenRequests: number;
  let campaignRequests: number;

  beforeEach(() => {
    tokenRequests = 0;
    campaignRequests = 0;
    const values: Record<string, string> = {
      ZOHO_CAMPAIGNS_CLIENT_ID: 'client-id',
      ZOHO_CAMPAIGNS_CLIENT_SECRET: 'client-secret',
      ZOHO_CAMPAIGNS_FROM_EMAIL: 'info@example.com',
      ZOHO_CAMPAIGNS_REFRESH_TOKEN: 'refresh-token',
    };
    const config = { get: jest.fn((key: string) => values[key]) } as unknown as ConfigService;
    const integrationRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    } as unknown as Repository<MarketingIntegration>;
    service = new ZohoCampaignsService(config, integrationRepo);

    fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/oauth/v2/token')) {
        tokenRequests += 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({ access_token: 'access-token', expires_in: 3600 }),
        } as Response;
      }
      campaignRequests += 1;
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ code: 0, status: 'success', list_of_details: [] }),
      } as Response;
    });
  });

  afterEach(() => fetchMock.mockRestore());

  it('reuses one Zoho access token across sequential API requests', async () => {
    for (let index = 0; index < 25; index += 1) {
      await expect(service.connectionStatus()).resolves.toEqual({ connected: true });
    }

    expect(tokenRequests).toBe(1);
    expect(campaignRequests).toBe(25);
  });

  it('deduplicates simultaneous access-token requests', async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => service.connectionStatus()));

    expect(results.every((result) => result.connected)).toBe(true);
    expect(tokenRequests).toBe(1);
    expect(campaignRequests).toBe(20);
  });

  it('reads and paginates Zoho recipient reports by status', async () => {
    const report: Record<string, string[]> = {
      openedcontacts: ['open1@example.com', 'open2@example.com', 'open3@example.com'],
      senthardbounce: ['hard@example.com'],
      sentsoftbounce: ['soft@example.com'],
      unsentcontacts: ['unsent@example.com'],
    };
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/oauth/v2/token')) {
        tokenRequests += 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({ access_token: 'access-token', expires_in: 3600 }),
        } as Response;
      }
      const body = init?.body as URLSearchParams;
      const action = body.get('action') || '';
      const fromIndex = Number(body.get('fromindex') || 1);
      const contacts = (report[action] || []).slice(fromIndex - 1, fromIndex + 1);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          code: 0,
          status: 'success',
          requestdetails: { range: 2, fromindex: fromIndex },
          list_of_details: contacts.map((email) => ({ contactemailaddress: email })),
        }),
      } as Response;
    });

    await expect(service.getRecipientReport('campaign-key')).resolves.toEqual({
      opened: report.openedcontacts,
      hardBounced: report.senthardbounce,
      softBounced: report.sentsoftbounce,
      unsent: report.unsentcontacts,
    });
    expect(tokenRequests).toBe(1);
  });

  it('treats Zoho no-contacts report code as an empty metric', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/oauth/v2/token')) {
        tokenRequests += 1;
        return {
          ok: true,
          status: 200,
          json: async () => ({ access_token: 'access-token', expires_in: 3600 }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ code: 6303, status: 'error', message: 'There are no contacts.' }),
      } as Response;
    });

    await expect(service.getRecipientReport('campaign-key')).resolves.toEqual({
      opened: [],
      hardBounced: [],
      softBounced: [],
      unsent: [],
    });
    expect(tokenRequests).toBe(1);
  });

  it('reads uppercase Zoho provider codes instead of reporting the HTTP status', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/oauth/v2/token')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ access_token: 'access-token', expires_in: 3600 }),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ Code: 1001, Message: "Pattern doesn't Match" }),
      } as Response;
    });

    await expect(service.connectionStatus()).resolves.toEqual({
      connected: false,
      error: expect.stringContaining("1001 Pattern doesn't Match"),
    });
  });

  it('sanitizes only the internal Zoho list name', () => {
    expect((service as any).safeListName('¿Estás listo para viajar? 🎶✨')).toBe('Estas listo para viajar');
  });

  it('isolates a rejected contact and continues preparing the valid audience', async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/oauth/v2/token')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ access_token: 'access-token', expires_in: 3600 }),
        } as Response;
      }
      const body = init?.body as URLSearchParams;
      const contact = JSON.parse(body.get('contactinfo') || '{}');
      const email = contact['Contact Email'];
      const payload = email === 'bad@example.com'
        ? { code: 2004, status: 'error', message: 'Invalid email address' }
        : { code: 0, status: 'success' };
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify(payload),
      } as Response;
    });

    await expect((service as any).ensureTopicAudience(
      'list-key',
      ['valid@example.com', 'bad@example.com', 'other@example.com'],
      'topic-id',
    )).resolves.toEqual({
      accepted: ['valid@example.com', 'other@example.com'],
      rejected: [{ email: 'bad@example.com', reason: 'Dirección de correo inválida.' }],
    });
  });
});
