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
    {} as any,
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
