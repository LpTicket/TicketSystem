import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { Event, VenueSection, Seat, Ticket, Order, OrderStatus, SeatStatus, SectionType, UserRole } from '../database/entities';

const table = (id: string) => ({ id, name: id, eventId: 'event-1', sectionType: SectionType.TABLE, rows: 1, seatsPerRow: 6, price: 10 });

function setup() {
  let sections = [table('section-1'), table('section-2'), table('section-3')];
  const event = { id: 'event-1', organizerId: 'owner', slug: 'event-one' };
  const eventRepo = {
    findOne: jest.fn().mockResolvedValue(event),
    save: jest.fn().mockResolvedValue(event),
    update: jest.fn().mockResolvedValue({}),
    manager: { findOne: jest.fn().mockResolvedValue({ role: UserRole.CLIENT }), transaction: jest.fn() },
  };
  const sectionRepo = {
    find: jest.fn().mockImplementation(async () => sections),
    create: jest.fn().mockImplementation(data => data),
    save: jest.fn().mockImplementation(async data => {
      const saved = data.map((section: any, index: number) => ({ ...section, id: section.id || `new-${index}` }));
      sections = [...sections.filter(section => !saved.some((item: any) => item.id === section.id)), ...saved];
      return saved;
    }),
    remove: jest.fn().mockImplementation(async data => {
      sections = sections.filter(section => !data.some((item: any) => item.id === section.id));
    }),
  };
  const seatRepo = { find: jest.fn().mockResolvedValue([]), save: jest.fn().mockResolvedValue([]), delete: jest.fn() };
  const query: any = {};
  for (const name of ['select', 'addSelect', 'where', 'andWhere', 'groupBy']) query[name] = jest.fn().mockReturnValue(query);
  query.getRawMany = jest.fn().mockResolvedValue([]);
  const ticketRepo = { exists: jest.fn().mockResolvedValue(false), createQueryBuilder: jest.fn().mockReturnValue(query) };
  const orderRepo = { find: jest.fn().mockResolvedValue([]) };
  const repositories = new Map<any, any>([[Event, eventRepo], [VenueSection, sectionRepo], [Seat, seatRepo], [Ticket, ticketRepo], [Order, orderRepo]]);
  const manager = { getRepository: jest.fn().mockImplementation(entity => repositories.get(entity)) };
  eventRepo.manager.transaction.mockImplementation(callback => callback(manager));
  const cache = { del: jest.fn(), get: jest.fn(), set: jest.fn() };
  const service = new EventsService(eventRepo as any, sectionRepo as any, seatRepo as any, ticketRepo as any, cache as any, {} as any);
  return { service, eventRepo, sectionRepo, seatRepo, ticketRepo, orderRepo, cache };
}

describe('Venue map deletion and reset', () => {
  it('clears all sections and resets inventory prices in a transaction', async () => {
    const { service, eventRepo, sectionRepo, cache } = setup();
    await expect(service.syncSections('event-1', [], 'owner', { showStage: false })).resolves.toEqual([]);
    expect(eventRepo.manager.transaction).toHaveBeenCalledTimes(1);
    expect(eventRepo.findOne).toHaveBeenCalledWith(expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
    expect(sectionRepo.remove).toHaveBeenCalledWith([table('section-1'), table('section-2'), table('section-3')]);
    expect(eventRepo.update).toHaveBeenCalledWith('event-1', { minPrice: 0, maxPrice: 0 });
    expect(cache.del).toHaveBeenCalledWith('event:seatmap:event-1');
  });

  it('deletes a whole selection while retaining other sections', async () => {
    const { service, sectionRepo } = setup();
    const result = await service.syncSections('event-1', [table('section-3')], 'owner');
    expect(result.map(section => section.id)).toEqual(['section-3']);
    expect(sectionRepo.remove).toHaveBeenCalledWith([table('section-1'), table('section-2')]);
  });

  it('can replace an unused map with a new layout', async () => {
    const { service, sectionRepo } = setup();
    const result = await service.syncSections('event-1', [{ name: 'New area', sectionType: SectionType.STANDING, capacity: 50, price: 15 }], 'owner');
    expect(result).toEqual([expect.objectContaining({ name: 'New area', capacity: 50, eventId: 'event-1' })]);
    expect(sectionRepo.remove).toHaveBeenCalledTimes(1);
  });

  it.each(['issued ticket', 'sold seat', 'active checkout hold', 'pending GA order', 'malformed pending order'])('rejects a reset with %s before any write', async kind => {
    const { service, eventRepo, sectionRepo, seatRepo, ticketRepo, orderRepo, cache } = setup();
    if (kind === 'issued ticket') ticketRepo.exists.mockResolvedValue(true);
    if (kind === 'sold seat') seatRepo.find.mockResolvedValue([{ id: 'seat-1', status: SeatStatus.SOLD }]);
    if (kind === 'active checkout hold') seatRepo.find.mockResolvedValue([{ id: 'seat-1', status: SeatStatus.LOCKED, lockExpiresAt: new Date(Date.now() + 60_000) }]);
    if (kind === 'pending GA order') orderRepo.find.mockResolvedValue([{ seatsData: JSON.stringify([{ sectionId: 'section-2' }]) }]);
    if (kind === 'malformed pending order') orderRepo.find.mockResolvedValue([{ seatsData: 'invalid' }]);
    await expect(service.syncSections('event-1', [], 'owner', { showStage: false })).rejects.toThrow(BadRequestException);
    expect(eventRepo.save).not.toHaveBeenCalled();
    expect(eventRepo.update).not.toHaveBeenCalled();
    expect(sectionRepo.remove).not.toHaveBeenCalled();
    expect(sectionRepo.save).not.toHaveBeenCalled();
    expect(seatRepo.delete).not.toHaveBeenCalled();
    expect(cache.del).not.toHaveBeenCalled();
  });

  it('checks paid orders too, protecting payments whose tickets are still being issued', async () => {
    const { service, orderRepo } = setup();
    orderRepo.find.mockResolvedValue([{ status: OrderStatus.PAID, seatsData: JSON.stringify([{ sectionId: 'section-1' }]) }]);
    await expect(service.syncSections('event-1', [], 'owner')).rejects.toThrow(BadRequestException);
    expect(orderRepo.find.mock.calls[0][0].where.status.value).toEqual([OrderStatus.PENDING, OrderStatus.PAID]);
  });

  it('checks tickets linked only by seat ID, including historical tickets', async () => {
    const { service, seatRepo, ticketRepo } = setup();
    seatRepo.find.mockResolvedValue([{ id: 'seat-1', status: SeatStatus.AVAILABLE }]);
    ticketRepo.exists.mockResolvedValue(true);
    await expect(service.syncSections('event-1', [], 'owner')).rejects.toThrow(BadRequestException);
    const { where } = ticketRepo.exists.mock.calls[0][0];
    expect(where).toHaveLength(2);
    expect(where[1].seatId.value).toEqual(['seat-1']);
    expect(where.every((condition: any) => !condition.status)).toBe(true);
  });

  it('allows permanent organizer blocks and expired holds to be removed', async () => {
    const { service, seatRepo } = setup();
    seatRepo.find.mockResolvedValue([
      { id: 'seat-1', status: SeatStatus.LOCKED, lockExpiresAt: null },
      { id: 'seat-2', status: SeatStatus.LOCKED, lockExpiresAt: new Date(Date.now() - 60_000) },
    ]);
    await expect(service.syncSections('event-1', [], 'owner')).resolves.toEqual([]);
  });

  it('preserves other sections with pending purchases when deleting unused sections', async () => {
    const { service, orderRepo } = setup();
    orderRepo.find.mockResolvedValue([{ seatsData: JSON.stringify([{ sectionId: 'section-3' }]) }]);
    await expect(service.syncSections('event-1', [table('section-3')], 'owner')).resolves.toHaveLength(1);
  });

  it('also prevents seat regeneration from deleting issued tickets', async () => {
    const { service, seatRepo, ticketRepo, sectionRepo } = setup();
    ticketRepo.exists.mockResolvedValue(true);
    await expect(service.syncSections('event-1', [{ ...table('section-1'), seatsPerRow: 8 }, table('section-2'), table('section-3')], 'owner')).rejects.toThrow(BadRequestException);
    expect(seatRepo.delete).not.toHaveBeenCalled();
    expect(sectionRepo.save).not.toHaveBeenCalled();
  });

  it('allows moving a saved map without destructive checks', async () => {
    const { service, ticketRepo } = setup();
    const result = await service.syncSections('event-1', [{ ...table('section-1'), mapX: 120 }, table('section-2'), table('section-3')], 'owner');
    expect(result).toContainEqual(expect.objectContaining({ id: 'section-1', mapX: 120 }));
    expect(ticketRepo.exists).not.toHaveBeenCalled();
  });

  it('does not invalidate caches when a map write fails', async () => {
    const { service, sectionRepo, cache } = setup();
    sectionRepo.remove.mockRejectedValue(new Error('database failure'));
    await expect(service.syncSections('event-1', [], 'owner')).rejects.toThrow('database failure');
    expect(cache.del).not.toHaveBeenCalled();
  });

  it('rejects a reset by a different organizer', async () => {
    const { service, sectionRepo, eventRepo } = setup();
    await expect(service.syncSections('event-1', [], 'another-owner')).rejects.toThrow(ForbiddenException);
    expect(sectionRepo.remove).not.toHaveBeenCalled();
    expect(eventRepo.manager.transaction).not.toHaveBeenCalled();
  });

  it.each([undefined, {}, { sections: null }, { sections: {} }])('rejects missing or malformed section lists (%s)', body => {
    const service = { syncSections: jest.fn() };
    const controller = new EventsController(service as any, {} as any);
    expect(() => controller.syncSections('event-1', body, { user: { id: 'owner' } })).toThrow(BadRequestException);
    expect(service.syncSections).not.toHaveBeenCalled();
  });

  it.each([[], { sections: [], showStage: false }])('accepts an explicit empty map (%s)', body => {
    const service = { syncSections: jest.fn() };
    const controller = new EventsController(service as any, {} as any);
    controller.syncSections('event-1', body, { user: { id: 'owner' } });
    expect(service.syncSections).toHaveBeenCalledWith('event-1', [], 'owner', expect.any(Object));
  });
});
