import { ForbiddenException } from '@nestjs/common';
import { EventStatus, UserRole } from '../database/entities';
import { EventsService } from './events.service';
import { validate } from 'class-validator';
import { UpdateEventDto } from './dto/event.dto';

function buildService(role: UserRole, status = EventStatus.PUBLISHED) {
  const event = { id: 'event-1', slug: 'event-one', organizerId: 'editor-1', status, klarnaEnabled: true };
  const eventRepo = {
    findOne: jest.fn().mockResolvedValue(event),
    manager: { findOne: jest.fn().mockResolvedValue({ id: 'editor-1', role }) },
    update: jest.fn().mockImplementation(async (_id, data) => Object.assign(event, data)),
  };
  const cache = { del: jest.fn(), get: jest.fn(), set: jest.fn() };
  const service = new EventsService(eventRepo as any, {} as any, {} as any, {} as any, cache as any, {} as any);
  return { service, eventRepo, cache };
}

describe('Event Klarna settings', () => {
  it.each(['false', 0, null])('rejects a non-boolean Klarna setting (%s)', async (klarnaEnabled) => {
    const errors = await validate(Object.assign(new UpdateEventDto(), { klarnaEnabled }));
    expect(errors.some((error) => error.property === 'klarnaEnabled')).toBe(true);
  });

  it.each([EventStatus.DRAFT, EventStatus.PUBLISHED])('prevents organizers from changing Klarna on a %s event', async (status) => {
    const { service, eventRepo } = buildService(UserRole.CLIENT, status);
    await expect(service.update('event-1', { klarnaEnabled: false }, 'editor-1')).rejects.toThrow(ForbiddenException);
    expect(eventRepo.update).not.toHaveBeenCalled();
  });

  it.each([false, true])('allows administrators to save Klarna as %s and invalidates public caches', async (klarnaEnabled) => {
    const { service, eventRepo, cache } = buildService(UserRole.ADMIN);
    await expect(service.update('event-1', { klarnaEnabled }, 'editor-1')).resolves.toMatchObject({ klarnaEnabled });
    expect(eventRepo.update).toHaveBeenCalledWith('event-1', { klarnaEnabled });
    expect(cache.del).toHaveBeenCalledWith('event:slug:event-one');
    expect(cache.set).toHaveBeenCalledWith('events:list:v', 1, 0);
  });

  it('preserves Klarna when an organizer edits ordinary event details', async () => {
    const { service, eventRepo } = buildService(UserRole.CLIENT);
    await service.update('event-1', { description: 'Updated details' }, 'editor-1');
    expect(eventRepo.update).toHaveBeenCalledWith('event-1', expect.objectContaining({ pendingDescription: 'Updated details' }));
    expect(eventRepo.update.mock.calls[0][1]).not.toHaveProperty('klarnaEnabled');
  });
});
