import { EventSupportRemindersService } from './event-support-reminders.service';
import { EventStatus } from '../database/entities/event.entity';
import { DataSource } from 'typeorm';
import * as entities from '../database/entities';

const NOW = new Date('2026-10-23T14:00:00Z');

function setup(overrides: Record<string, unknown> = {}) {
  const event = {
    id: 'event-1', title: 'Evento de la mañana',
    status: EventStatus.PUBLISHED, eventDate: new Date('2026-10-24T14:00:00Z'),
    eventTimezone: 'America/Chicago', venueName: 'Salón Principal', venueAddress: '123 Main St',
    organizerId: 'owner-1',
    organizer: { id: 'owner-1', firstName: 'Ana', lastName: 'Pérez', email: 'owner@example.com', phone: '+15555550123' },
    organizerSupportReminderForDate: null, adminSupportReminderForDate: null,
    ...overrides,
  };
  const query = {
    select: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(), getMany: jest.fn().mockResolvedValue([{ id: event.id }]),
  };
  const repo = {
    findOne: jest.fn().mockImplementation(async () => ({ ...event })),
    update: jest.fn().mockImplementation(async (_where, values) => {
      Object.assign(event, values);
      return { affected: 1 };
    }),
  };
  const runner = {
    connect: jest.fn().mockResolvedValue(undefined), release: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue([{ locked: true }]),
    manager: { getRepository: jest.fn().mockReturnValue(repo) },
  };
  const source = {
    getRepository: jest.fn().mockReturnValue({ createQueryBuilder: () => query }),
    createQueryRunner: jest.fn().mockReturnValue(runner),
  };
  const mail = { sendEventSupportReminder: jest.fn().mockResolvedValue(true) };
  const config = { get: jest.fn((key) => key === 'ADMIN_EMAIL' ? 'admin@example.com' : undefined) };
  const service = new EventSupportRemindersService(source as any, config as any, mail as any);
  return { service, event, repo, runner, source, query, mail, config };
}

describe('Event support reminders', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });
  afterEach(() => jest.useRealTimers());

  it('sends two separate reminders 24h before a morning event with only its organizer contact', async () => {
    const { service, mail, repo, query } = setup();
    await service.handleReminders();
    expect(query.andWhere).toHaveBeenCalledWith(expect.stringContaining('event.eventDate > :now'), {
      now: NOW, deadline: new Date('2026-10-24T14:00:00Z'),
    });
    expect(mail.sendEventSupportReminder.mock.calls.map(([to, , audience]) => [to, audience])).toEqual([
      ['owner@example.com', 'organizer'], ['admin@example.com', 'admin'],
    ]);
    expect(mail.sendEventSupportReminder).toHaveBeenCalledWith('admin@example.com', expect.objectContaining({
      organizerName: 'Ana Pérez', organizerEmail: 'owner@example.com', organizerPhone: '+15555550123',
      eventTimezone: 'America/Chicago',
    }), 'admin');
    expect(repo.update).toHaveBeenCalledTimes(2);
  });

  it('generates PostgreSQL queries with the correct aliases, private checkpoints and limited organizer data', async () => {
    const dataSource = new DataSource({
      type: 'postgres', entities: Object.values(entities).filter((value) => typeof value === 'function'),
    });
    await (dataSource as any).buildMetadatas();
    const query = dataSource.getRepository(entities.Event).createQueryBuilder('event');
    jest.spyOn(query, 'getMany').mockResolvedValue([]);
    const { service, source, repo, query: mockQuery } = setup();
    source.getRepository.mockReturnValue({ createQueryBuilder: () => query } as any);
    await service.handleReminders();
    const [sql, parameters] = query.getQueryAndParameters();
    expect(sql).toContain('"event"."organizerSupportReminderForDate" IS DISTINCT FROM "event"."eventDate"');
    expect(sql).toContain('"event"."adminSupportReminderForDate" IS DISTINCT FROM "event"."eventDate"');
    expect(sql).not.toMatch(/(?<!["\w])event\./);
    expect(parameters).toEqual([EventStatus.PUBLISHED, NOW, new Date('2026-10-24T14:00:00Z')]);
    expect(dataSource.getRepository(entities.Event).createQueryBuilder('event').getSql())
      .not.toContain('SupportReminderForDate');

    source.getRepository.mockReturnValue({ createQueryBuilder: () => mockQuery });
    await service.handleReminders();
    const selectedSql = dataSource.getRepository(entities.Event).createQueryBuilder('event')
      .setFindOptions(repo.findOne.mock.calls[0][0]).getSql();
    expect(selectedSql).toContain('"organizerSupportReminderForDate"');
    expect(selectedSql).toContain('"phone"');
    expect(selectedSql).not.toContain('"passwordHash"');
    expect(selectedSql).not.toContain('"idNumber"');
  });

  it.each([
    ['more than 24h ahead', { eventDate: new Date('2026-10-24T14:00:01Z') }],
    ['already started', { eventDate: NOW }],
    ['past', { eventDate: new Date('2026-10-22T14:00:00Z') }],
    ...[EventStatus.DRAFT, EventStatus.PENDING_APPROVAL, EventStatus.CANCELLED, EventStatus.COMPLETED]
      .map((status) => [status, { status }]),
  ])('does not send for an event %s, even if the candidate snapshot is stale', async (_label, overrides) => {
    const { service, mail } = setup(overrides as Record<string, unknown>);
    await service.handleReminders();
    expect(mail.sendEventSupportReminder).not.toHaveBeenCalled();
  });

  it('recovers an unsent reminder inside the 24h window without sending after the event starts', async () => {
    const { service, mail } = setup({ eventDate: new Date('2026-10-23T15:00:00Z') });
    await service.handleReminders();
    expect(mail.sendEventSupportReminder).toHaveBeenCalledTimes(2);
  });

  it('does not repeat persisted reminders after a restart', async () => {
    const { service, source, config, mail } = setup();
    await service.handleReminders();
    const restarted = new EventSupportRemindersService(source as any, config as any, mail as any);
    await restarted.handleReminders();
    expect(mail.sendEventSupportReminder).toHaveBeenCalledTimes(2);
  });

  it.each(['organizer', 'admin'])('retries only the %s reminder after a partial SMTP failure', async (failedAudience) => {
    const { service, mail, repo } = setup();
    mail.sendEventSupportReminder.mockImplementation(async (_to, _data, audience) => audience !== failedAudience);
    await service.handleReminders();
    expect(repo.update).toHaveBeenCalledTimes(1);
    mail.sendEventSupportReminder.mockResolvedValue(true);
    await service.handleReminders();
    expect(mail.sendEventSupportReminder).toHaveBeenCalledTimes(3);
    expect(mail.sendEventSupportReminder.mock.calls[2][2]).toBe(failedAudience);
    expect(repo.update).toHaveBeenCalledTimes(2);
  });

  it('makes a rescheduled date eligible while retaining the earlier delivery history', async () => {
    const { service, event, mail } = setup();
    await service.handleReminders();
    event.eventDate = new Date('2026-10-24T15:00:00Z');
    await service.handleReminders();
    expect(mail.sendEventSupportReminder).toHaveBeenCalledTimes(2);
    jest.setSystemTime(new Date('2026-10-23T15:00:00Z'));
    await service.handleReminders();
    expect(mail.sendEventSupportReminder).toHaveBeenCalledTimes(4);
  });

  it('skips events currently being processed by another replica', async () => {
    const { service, runner, mail } = setup();
    runner.query.mockResolvedValue([{ locked: false }]);
    await service.handleReminders();
    expect(mail.sendEventSupportReminder).not.toHaveBeenCalled();
    expect(runner.query).toHaveBeenCalledTimes(1);
    expect(runner.release).toHaveBeenCalledTimes(1);
  });

  it('releases the lock and connection if saving the checkpoint fails', async () => {
    const { service, runner, repo } = setup();
    repo.update.mockRejectedValue(new Error('DB unavailable'));
    await service.handleReminders();
    expect(runner.query).toHaveBeenLastCalledWith(
      'SELECT pg_advisory_unlock($1, hashtext($2))', [240024, 'event-1'],
    );
    expect(runner.release).toHaveBeenCalledTimes(1);
  });

  it('rechecks cancellation before sending the second email', async () => {
    const { service, event, mail } = setup();
    mail.sendEventSupportReminder.mockImplementation(async () => {
      event.status = EventStatus.CANCELLED;
      return true;
    });
    await service.handleReminders();
    expect(mail.sendEventSupportReminder).toHaveBeenCalledTimes(1);
  });

  it('still alerts administration if the organizer has no email', async () => {
    const { service, mail } = setup({ organizer: null });
    await service.handleReminders();
    expect(mail.sendEventSupportReminder).toHaveBeenCalledTimes(1);
    expect(mail.sendEventSupportReminder.mock.calls[0][0]).toBe('admin@example.com');
  });

  it('uses the LP Ticket administrative mailbox when no ADMIN_EMAIL is configured', async () => {
    const { service, config, mail } = setup();
    config.get.mockReturnValue(undefined);
    await service.handleReminders();
    expect(mail.sendEventSupportReminder.mock.calls[1][0]).toBe('info@lpticket.com');
  });
});
