import { ForbiddenException } from '@nestjs/common';
import { EventStatus, ScannerAccessStatus, UserRole } from '../database/entities';
import { ScannerAccessService } from './scanner-access.service';

function buildService(overrides: Record<string, any> = {}) {
  const scannerAccessRepo = {
    findOne: jest.fn().mockResolvedValue(null),
    findOneOrFail: jest.fn().mockImplementation(async ({ where }: any) => ({ id: where.id })),
    create: jest.fn((value) => ({ id: 'access-1', ...value })),
    save: jest.fn(async (value) => value),
    ...overrides.scannerAccessRepo,
  };
  const eventRepo = {
    findOne: jest.fn().mockResolvedValue({
      id: 'event-1',
      organizerId: 'organizer-1',
      status: EventStatus.PUBLISHED,
    }),
    ...overrides.eventRepo,
  };
  const userRepo = {
    findOne: jest.fn().mockResolvedValue({ id: 'employee-1', isActive: true }),
    ...overrides.userRepo,
  };
  const service = new ScannerAccessService(
    scannerAccessRepo as any,
    eventRepo as any,
    userRepo as any,
    (overrides.ordersService || {}) as any,
  );
  return { service, scannerAccessRepo, eventRepo, userRepo };
}

describe('ScannerAccessService administrative requests', () => {
  it('creates a pending employee request without modifying the event', async () => {
    const { service, scannerAccessRepo, eventRepo } = buildService();

    await service.requestAccessForUser(
      'event-1',
      'employee-1',
      { id: 'admin-1', role: UserRole.ADMIN },
    );

    expect(scannerAccessRepo.create).toHaveBeenCalledWith({
      eventId: 'event-1',
      organizerId: 'organizer-1',
      userId: 'employee-1',
      status: ScannerAccessStatus.PENDING,
      decidedById: 'admin-1',
    });
    expect(scannerAccessRepo.save).toHaveBeenCalledTimes(1);
    expect(eventRepo.findOne).toHaveBeenCalledTimes(1);
    expect((eventRepo as any).save).toBeUndefined();
  });

  it('refuses administrative requests from a non-admin user', async () => {
    const { service, scannerAccessRepo } = buildService();

    await expect(service.requestAccessForUser(
      'event-1',
      'employee-1',
      { id: 'client-1', role: UserRole.CLIENT },
    )).rejects.toBeInstanceOf(ForbiddenException);

    expect(scannerAccessRepo.save).not.toHaveBeenCalled();
  });
});

function accessFlow() {
  let record: any = null;
  const ordersService = {
    getScannerEventStatsForApprovedEmployee: jest.fn().mockResolvedValue({ sold: 3 }),
    searchEventTicketsGrouped: jest.fn().mockResolvedValue([]),
  };
  const fixture = buildService({
    ordersService,
    scannerAccessRepo: {
      findOne: jest.fn(async ({ where }: any) => record && Object.entries(where).every(([key, value]) => record[key] === value) ? record : null),
      findOneOrFail: jest.fn(async () => record),
      save: jest.fn(async value => { record = { ...value }; return record; }),
    },
  });
  return { ...fixture, ordersService };
}

describe('Staff access request, approval and removal', () => {
  it('keeps a new request pending until an administrator approves it and enables only its event', async () => {
    const { service, ordersService } = accessFlow();
    const request = await service.requestAccessForUser('event-1', 'employee-1', { id: 'admin-1', role: UserRole.ADMIN });
    expect(request.status).toBe(ScannerAccessStatus.PENDING);
    expect(await service.userCanScanEvent('employee-1', 'event-1')).toBe(false);
    await expect(service.getEventStatsForEmployee('event-1', { id: 'employee-1' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(ordersService.getScannerEventStatsForApprovedEmployee).not.toHaveBeenCalled();
    const approved = await service.decideRequest(request.id, ScannerAccessStatus.APPROVED, { id: 'admin-1', role: UserRole.ADMIN });
    expect(approved.approvedAt).toBeInstanceOf(Date);
    expect(await service.userCanScanEvent('employee-1', 'event-1')).toBe(true);
    expect(await service.userCanScanEvent('employee-1', 'other-event')).toBe(false);
    expect(await service.userCanScanEvent('other-employee', 'event-1')).toBe(false);
    await service.getEventStatsForEmployee('event-1', { id: 'employee-1' });
    expect(ordersService.getScannerEventStatsForApprovedEmployee).toHaveBeenCalledWith('event-1');
  });

  it('allows the event owner to approve and revoke access, then blocks staff operations', async () => {
    const { service, ordersService } = accessFlow();
    const request = await service.requestAccess('event-1', 'employee-1');
    const owner = { id: 'organizer-1', role: UserRole.CLIENT };
    await service.decideRequest(request.id, ScannerAccessStatus.APPROVED, owner);
    await service.searchTicketsForEmployee('event-1', 'QA', { id: 'employee-1' });
    expect(ordersService.searchEventTicketsGrouped).toHaveBeenCalledWith('event-1', 'QA', { id: 'employee-1', role: 'admin' });
    await service.decideRequest(request.id, ScannerAccessStatus.REVOKED, owner);
    expect(await service.userCanScanEvent('employee-1', 'event-1')).toBe(false);
    await expect(service.searchTicketsForEmployee('event-1', 'QA', { id: 'employee-1' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not allow a different organizer to approve a request', async () => {
    const { service, scannerAccessRepo } = accessFlow();
    const request = await service.requestAccess('event-1', 'employee-1');
    const saves = scannerAccessRepo.save.mock.calls.length;
    await expect(service.decideRequest(request.id, ScannerAccessStatus.APPROVED, { id: 'other', role: UserRole.CLIENT })).rejects.toBeInstanceOf(ForbiddenException);
    expect(scannerAccessRepo.save).toHaveBeenCalledTimes(saves);
    expect(await service.userCanScanEvent('employee-1', 'event-1')).toBe(false);
  });

  it.each([ScannerAccessStatus.PENDING, ScannerAccessStatus.APPROVED])('preserves existing %s access instead of issuing a duplicate', async status => {
    const { service, scannerAccessRepo } = accessFlow();
    const admin = { id: 'admin-1', role: UserRole.ADMIN };
    const request = await service.requestAccessForUser('event-1', 'employee-1', admin);
    if (status === ScannerAccessStatus.APPROVED) await service.decideRequest(request.id, status, admin);
    const saves = scannerAccessRepo.save.mock.calls.length;
    const repeated = await service.requestAccessForUser('event-1', 'employee-1', admin);
    expect(repeated).toMatchObject({ id: request.id, status });
    expect(scannerAccessRepo.save).toHaveBeenCalledTimes(saves);
  });

  it.each([ScannerAccessStatus.REJECTED, ScannerAccessStatus.REVOKED])('resets %s access to pending when the employee applies again', async status => {
    const { service } = accessFlow();
    const admin = { id: 'admin-1', role: UserRole.ADMIN };
    const request = await service.requestAccessForUser('event-1', 'employee-1', admin);
    await service.decideRequest(request.id, status, admin);
    const renewed = await service.requestAccessForUser('event-1', 'employee-1', admin);
    expect(renewed).toMatchObject({ id: request.id, status: ScannerAccessStatus.PENDING, approvedAt: null, rejectedAt: null, revokedAt: null });
  });

  it('rejects requests for an inactive employee or an unpublished event', async () => {
    const inactive = buildService({ userRepo: { findOne: jest.fn().mockResolvedValue({ isActive: false }) } });
    await expect(inactive.service.requestAccess('event-1', 'employee-1')).rejects.toThrow('not active');
    expect(inactive.scannerAccessRepo.save).not.toHaveBeenCalled();
    const draft = buildService({ eventRepo: { findOne: jest.fn().mockResolvedValue({ status: EventStatus.DRAFT }) } });
    await expect(draft.service.requestAccess('event-1', 'employee-1')).rejects.toThrow('Only published');
    expect(draft.scannerAccessRepo.save).not.toHaveBeenCalled();
  });
});
