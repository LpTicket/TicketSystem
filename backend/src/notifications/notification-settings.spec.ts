import { BadRequestException, ConflictException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { NOTIFICATION_CATALOG } from './notification-catalog';
import { UpdateNotificationSettingsDto } from './notification-settings.dto';
import { NotificationSettingsService } from './notification-settings.service';

describe('Global notification preferences', () => {
  const setup = (preferences: Record<string, boolean> = {}) => {
    const record = { id: 'global', preferences, version: 1, updatedAt: new Date('2026-11-03T12:00:00Z'), updatedBy: null };
    const repo = {
      findOneBy: jest.fn().mockResolvedValue(record),
      findOne: jest.fn().mockResolvedValue(record),
      save: jest.fn().mockImplementation(async (value) => value),
      manager: { transaction: jest.fn() },
    };
    repo.manager.transaction.mockImplementation(async (work) => work({ getRepository: () => repo }));
    return { service: new NotificationSettingsService(repo as any), repo, record };
  };

  it('preserves existing deliveries and leaves the two new login alerts disabled', async () => {
    const { service } = setup();
    const response = await service.getSettings();
    expect(new Set(response.items.map((item) => item.key)).size).toBe(NOTIFICATION_CATALOG.length);
    expect(response.items.filter((item) => !item.enabled).map((item) => item.key)).toEqual(['login_client', 'login_admin']);
    expect(response.items).toHaveLength(23);
  });

  it('persists explicit changes without overwriting unrelated preferences', async () => {
    const { service, repo, record } = setup({ marketing_sms: false });
    const response = await service.update({ version: 1, changes: [{ key: 'welcome_email', enabled: false }, { key: 'login_admin', enabled: true }] }, 'admin-1');
    expect(repo.findOne).toHaveBeenCalledWith(expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
    expect(record.preferences).toEqual({ marketing_sms: false, welcome_email: false, login_admin: true });
    expect(record.updatedBy).toBe('admin-1');
    expect(response.version).toBe(2);
    expect(await service.isEnabled('welcome_email')).toBe(false);
    await expect(service.requireEnabled('welcome_email')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects stale edits instead of losing another administrator’s changes', async () => {
    const { service, repo } = setup();
    await expect(service.update({ version: 2, changes: [{ key: 'ticket_email', enabled: false }] }, 'admin-1')).rejects.toBeInstanceOf(ConflictException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('only falls back to historical behavior when the table is absent during rollout', async () => {
    const { service, repo } = setup();
    repo.findOneBy.mockRejectedValue({ driverError: { code: '42P01' } });
    expect(await service.isEnabled('ticket_email')).toBe(true);
    expect(await service.isEnabled('login_client')).toBe(false);
    await expect(service.getSettings()).rejects.toEqual({ driverError: { code: '42P01' } });
    repo.findOneBy.mockRejectedValue(new Error('database unavailable'));
    await expect(service.isEnabled('marketing_email')).rejects.toThrow('database unavailable');
  });

  it.each([
    { version: 1, changes: [{ key: 'unknown', enabled: false }] },
    { version: 1, changes: [{ key: 'welcome_email', enabled: 'false' }] },
    { version: 1, changes: [{ key: 'welcome_email', enabled: 0 }] },
    { version: 1, changes: [{ key: 'welcome_email', enabled: true }, { key: 'welcome_email', enabled: false }] },
    { version: 0, changes: [{ key: 'welcome_email', enabled: true }] },
    { version: 1, changes: [] },
  ])('rejects malformed configuration %#', async (body) => {
    const dto = plainToInstance(UpdateNotificationSettingsDto, body, { enableImplicitConversion: true });
    expect((await validate(dto)).length).toBeGreaterThan(0);
  });
});
