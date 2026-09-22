import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { OrderStatus } from '../database/entities';
import { SpecialCodesService } from './special-codes.service';

function makeService() {
  const referralRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((data) => data),
    save: jest.fn(async (data) => data),
    remove: jest.fn(async (data) => data),
  };
  const eventRepo = { findOne: jest.fn() };
  const specialCodeRepo = { findOne: jest.fn() };
  const orderRepo = { find: jest.fn(), count: jest.fn() };
  const service = new SpecialCodesService(
    specialCodeRepo as any, {} as any, eventRepo as any, orderRepo as any, {} as any, referralRepo as any,
  );
  return { service, referralRepo, eventRepo, specialCodeRepo, orderRepo };
}

describe('event referrals', () => {
  it('restricts creation to the event owner or admin', async () => {
    const { service, eventRepo } = makeService();
    eventRepo.findOne.mockResolvedValue({ id: 'event-1', organizerId: 'organizer-1' });
    await expect(service.createEventReferral('event-1', { id: 'other', role: 'client' }, { name: 'Beatriz', code: 'BEATRIZ' }))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates an event-scoped name and code without a commission owner', async () => {
    const { service, referralRepo, eventRepo, specialCodeRepo } = makeService();
    eventRepo.findOne.mockResolvedValue({ id: 'event-1', organizerId: 'organizer-1' });
    referralRepo.findOne.mockResolvedValue(null);
    specialCodeRepo.findOne.mockResolvedValue(null);
    const created = await service.createEventReferral('event-1', { id: 'organizer-1' }, { name: ' Beatriz ', code: ' beatriz ' });
    expect(created).toMatchObject({ eventId: 'event-1', name: 'Beatriz', code: 'BEATRIZ', isActive: true });
  });

  it('rejects a code already used by a global special code', async () => {
    const { service, referralRepo, eventRepo, specialCodeRepo } = makeService();
    eventRepo.findOne.mockResolvedValue({ id: 'event-1', organizerId: 'organizer-1' });
    referralRepo.findOne.mockResolvedValue(null);
    specialCodeRepo.findOne.mockResolvedValue({ code: 'BEATRIZ', eventId: null });
    await expect(service.createEventReferral('event-1', { id: 'organizer-1' }, { name: 'Beatriz', code: 'BEATRIZ' }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it('counts only paid purchases attributed to the event code', async () => {
    const { service, referralRepo, eventRepo, orderRepo } = makeService();
    eventRepo.findOne.mockResolvedValue({ id: 'event-1', organizerId: 'organizer-1' });
    referralRepo.find.mockResolvedValue([{ id: 'ref-1', eventId: 'event-1', name: 'Beatriz', code: 'BEATRIZ' }]);
    orderRepo.find.mockResolvedValue([
      { id: 'order-1', referralCode: 'BEATRIZ', ticketCount: 2, subtotal: 40, user: { firstName: 'Ana', lastName: 'Pérez', email: 'private@example.com' } },
      { id: 'order-2', referralCode: 'OTHER', ticketCount: 1, subtotal: 20, user: { firstName: 'Luis', lastName: 'Díaz' } },
    ]);
    const result = await service.getEventReferrals('event-1', { id: 'organizer-1' });
    expect(result[0]).toMatchObject({ orders: 1, tickets: 2, revenue: 40 });
    expect(result[0].purchases).toEqual([{ id: 'order-1', buyerName: 'Ana Pérez', ticketCount: 2 }]);
    expect(orderRepo.find).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ eventId: 'event-1', status: OrderStatus.PAID }),
      relations: ['user'],
    }));
  });

  it('does not reveal buyer names to someone outside the event', async () => {
    const { service, eventRepo, orderRepo } = makeService();
    eventRepo.findOne.mockResolvedValue({ id: 'event-1', organizerId: 'organizer-1' });
    await expect(service.getEventReferrals('event-1', { id: 'other', role: 'client' }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(orderRepo.find).not.toHaveBeenCalled();
  });

  it('deletes an unused event referral', async () => {
    const { service, referralRepo, eventRepo, orderRepo } = makeService();
    const referral = { id: 'ref-1', eventId: 'event-1', code: 'BEATRIZ' };
    eventRepo.findOne.mockResolvedValue({ id: 'event-1', organizerId: 'organizer-1' });
    referralRepo.findOne.mockResolvedValue(referral);
    orderRepo.count.mockResolvedValue(0);

    await expect(service.deleteEventReferral('event-1', 'ref-1', { id: 'organizer-1' })).resolves.toEqual({ success: true });
    expect(referralRepo.remove).toHaveBeenCalledWith(referral);
  });

  it('preserves referral history when it already has purchases', async () => {
    const { service, referralRepo, eventRepo, orderRepo } = makeService();
    eventRepo.findOne.mockResolvedValue({ id: 'event-1', organizerId: 'organizer-1' });
    referralRepo.findOne.mockResolvedValue({ id: 'ref-1', eventId: 'event-1', code: 'BEATRIZ' });
    orderRepo.count.mockResolvedValue(1);

    await expect(service.deleteEventReferral('event-1', 'ref-1', { id: 'organizer-1' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(referralRepo.remove).not.toHaveBeenCalled();
  });
});
