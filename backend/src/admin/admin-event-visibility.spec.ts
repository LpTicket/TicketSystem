import { BadRequestException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { Event, EventStatus, UserRole } from '../database/entities';

function setup() {
  const event = { id: 'past-event', slug: 'past-event', organizerId: 'organizer',
    status: EventStatus.COMPLETED, eventDate: new Date('2020-01-01'), publicVisible: true, isFeatured: true };
  const manager = { delete: jest.fn(), find: jest.fn().mockResolvedValue([]), transaction: jest.fn() };
  manager.transaction.mockImplementation(async (run) => run(manager));
  const eventRepo = { findAndCount: jest.fn().mockResolvedValue([[], 0]),
    findOne: jest.fn().mockResolvedValue(event), save: jest.fn(async (value) => value), manager };
  const cache = { get: jest.fn().mockResolvedValue(2), set: jest.fn(), del: jest.fn() };
  const service = new AdminService({} as any, eventRepo as any, {} as any, {} as any,
    {} as any, {} as any, {} as any, cache as any, {} as any);
  return { service, event, eventRepo, cache, manager };
}

describe('Administrative event visibility', () => {
  it.each([['visible', true], ['hidden', false]] as const)('paginates %s events in the database', async (visibility, publicVisible) => {
    const { service, eventRepo } = setup();
    await service.getAllEvents(2, 15, undefined, visibility);
    expect(eventRepo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({
      where: { publicVisible }, skip: 15, take: 15,
    }));
  });

  it('combines status and visibility and preserves the existing unfiltered API', async () => {
    const { service, eventRepo } = setup();
    await service.getAllEvents(1, 50, EventStatus.COMPLETED, 'visible');
    expect(eventRepo.findAndCount).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { status: EventStatus.COMPLETED, publicVisible: true },
    }));
    await service.getAllEvents(1, 50);
    expect(eventRepo.findAndCount).toHaveBeenLastCalledWith(expect.objectContaining({ where: {} }));
    await expect(service.getAllEvents(1, 15, undefined, 'unknown')).rejects.toThrow(BadRequestException);
  });

  it('hides and restores a past event without deleting sales, tickets, or changing status', async () => {
    const { service, event, cache, manager } = setup();
    await expect(service.togglePublicVisibility(event.id)).resolves.toMatchObject({ publicVisible: false, isFeatured: false });
    expect(event.status).toBe(EventStatus.COMPLETED);
    expect(manager.delete).not.toHaveBeenCalled();
    expect(cache.del).toHaveBeenCalledWith('organizer:events:organizer');
    expect(cache.del).toHaveBeenCalledWith('event:slug:past-event');
    expect(cache.del).toHaveBeenCalledWith('events:featured');
    expect(cache.set).toHaveBeenCalledWith('events:list:v', 3, 0);
    await expect(service.togglePublicVisibility(event.id)).resolves.toMatchObject({ publicVisible: true });
  });

  it('invalidates event lists after an explicit deletion', async () => {
    const { service, event, cache, manager } = setup();
    await service.deleteEvent(event.id);
    expect(manager.delete).toHaveBeenCalledWith(Event, { id: event.id });
    expect(cache.del).toHaveBeenCalledWith('organizer:events:organizer');
    expect(cache.del).toHaveBeenCalledWith('event:slug:past-event');
    expect(cache.set).toHaveBeenCalledWith('events:list:v', 3, 0);
  });

  it.each([UserRole.ADMIN, UserRole.CLIENT, undefined])('protects visibility changes from role %s', (role) => {
    const guard = new RolesGuard(new Reflector());
    const context = { getHandler: () => AdminController.prototype.togglePublicVisibility,
      getClass: () => AdminController,
      switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }) };
    expect(guard.canActivate(context as any)).toBe(role === UserRole.ADMIN);
  });
});
