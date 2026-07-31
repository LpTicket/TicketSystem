import { Order, OrderStatus, Ticket, TicketStatus } from '../database/entities';
import { OrdersService } from './orders.service';

function buildService(overrides: Record<string, any> = {}) {
  const ticketRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
    ...overrides.ticketRepo,
  };
  const eventRepo = {
    findOne: jest.fn(),
    ...overrides.eventRepo,
  };
  const orderRepo = {
    manager: overrides.manager || { transaction: jest.fn() },
    ...overrides.orderRepo,
  };
  const service = new OrdersService(
    orderRepo as any,
    ticketRepo as any,
    (overrides.seatRepo || {}) as any,
    eventRepo as any,
    (overrides.sectionRepo || {}) as any,
    (overrides.specialCodeRepo || {}) as any,
    (overrides.scannerAccessRepo || {}) as any,
    (overrides.paymentMethodRepo || {}) as any,
    ({ get: jest.fn(() => undefined) }) as any,
    ({ sendTicketEmail: jest.fn() }) as any,
    ({ sendTransactionalSms: jest.fn() }) as any,
    ({ del: jest.fn(), get: jest.fn(), set: jest.fn() }) as any,
  );
  return { service, ticketRepo, eventRepo, orderRepo };
}

describe('OrdersService critical ticket safeguards', () => {
  it('does not consume a valid ticket when the selected event is different', async () => {
    const { service, ticketRepo, eventRepo } = buildService();
    eventRepo.findOne.mockResolvedValue({ id: 'event-a', organizerId: 'organizer-1' });
    ticketRepo.findOne.mockResolvedValue({
      id: 'ticket-1',
      eventId: 'event-b',
      status: TicketStatus.ACTIVE,
      event: { organizerId: 'organizer-1' },
    });

    const result = await service.validateTicket(
      'CODE-1',
      { id: 'organizer-1', role: 'client' },
      { eventId: 'event-a' },
    );

    expect(result).toMatchObject({ valid: false, reason: 'wrong_event' });
    expect(ticketRepo.update).not.toHaveBeenCalled();
  });

  it('accepts an active ticket only when the atomic update succeeds', async () => {
    const { service, ticketRepo } = buildService();
    ticketRepo.findOne.mockResolvedValue({
      id: 'ticket-1',
      eventId: 'event-a',
      status: TicketStatus.ACTIVE,
      event: { organizerId: 'organizer-1' },
    });
    ticketRepo.update.mockResolvedValue({ affected: 0 });

    const result = await service.validateTicket('CODE-1', { id: 'organizer-1', role: 'client' });

    expect(result).toMatchObject({ valid: false, reason: 'used' });
  });

  it('returns the existing ticket set when Stripe repeats fulfillment', async () => {
    const existingTicket = { id: 'ticket-1', orderId: 'order-1' };
    const transactionTicketRepo = {
      find: jest.fn().mockResolvedValue([existingTicket]),
      save: jest.fn(),
    };
    const orderQuery = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 'order-1',
        userId: 'user-1',
        status: OrderStatus.PAID,
      }),
    };
    const transactionOrderRepo = { createQueryBuilder: jest.fn(() => orderQuery) };
    const manager = {
      transaction: jest.fn(async (callback: any) => callback({
        getRepository: (entity: any) => entity === Order ? transactionOrderRepo : entity === Ticket ? transactionTicketRepo : {},
      })),
    };
    const { service } = buildService({ manager });

    const result = await (service as any).finalizePaidOrder('order-1', 'pi_1');

    expect(result).toEqual([existingTicket]);
    expect(orderQuery.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(transactionTicketRepo.save).not.toHaveBeenCalled();
  });
});
