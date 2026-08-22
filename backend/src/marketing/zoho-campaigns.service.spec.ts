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
});
