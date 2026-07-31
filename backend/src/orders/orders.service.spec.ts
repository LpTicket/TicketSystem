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
    (overrides.configService || { get: jest.fn(() => undefined) }) as any,
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

  it('accepts a signed guest link only for a Tap to Pay door-sale ticket', async () => {
    const configService = {
      get: jest.fn((key: string) => key === 'TICKET_GUEST_LINK_SECRET' ? 'test-guest-secret' : undefined),
    };
    const { service, ticketRepo } = buildService({ configService });
    const order = {
      id: 'order-door-1',
      salesChannel: 'door_sale_tap_to_pay',
      event: { eventDate: new Date(Date.now() + 86_400_000) },
    };
    const ticket = {
      id: 'ticket-door-1',
      ticketCode: 'DOOR-CODE-1',
      orderId: order.id,
      order,
      event: { id: 'event-1', title: 'Evento' },
      user: { firstName: 'Cliente', lastName: 'Puerta' },
    };
    ticketRepo.findOne.mockResolvedValue(ticket);

    const access = (service as any).createGuestTicketAccess(ticket, order);
    const result = await service.getGuestTicketByCode(ticket.ticketCode, access);

    expect(result).toMatchObject({ id: ticket.id, ticketCode: ticket.ticketCode });
  });

  it('rejects guest access for a regular online order', async () => {
    const configService = {
      get: jest.fn((key: string) => key === 'TICKET_GUEST_LINK_SECRET' ? 'test-guest-secret' : undefined),
    };
    const { service, ticketRepo } = buildService({ configService });
    ticketRepo.findOne.mockResolvedValue({
      id: 'ticket-online-1',
      ticketCode: 'ONLINE-CODE-1',
      orderId: 'order-online-1',
      order: { id: 'order-online-1', salesChannel: 'online' },
      event: { id: 'event-1' },
      user: { firstName: 'Cliente', lastName: 'Web' },
    });

    await expect(service.getGuestTicketByCode('ONLINE-CODE-1', `v1.${Math.floor(Date.now() / 1000) + 3600}.${'a'.repeat(64)}`))
      .rejects.toThrow('El enlace de la entrada no es válido o ya venció.');
  });
});
