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
  const mailService = overrides.mailService || { sendTicketEmail: jest.fn() };
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
    mailService as any,
    ({ sendTransactionalSms: jest.fn() }) as any,
    ({ del: jest.fn(), get: jest.fn(), set: jest.fn() }) as any,
  );
  return { service, ticketRepo, eventRepo, orderRepo, mailService };
}

describe('OrdersService critical ticket safeguards', () => {
  it('uses the official fee formula for web, mobile, Door Sale, and Tap to Pay', () => {
    const { service } = buildService();

    const event = { maxTicketsPerTransaction: 30, serviceFeePercent: 0.5, processingFeePercent: 0.5 };
    const invoice = (service as any).calculateOrderFees(event, [{ price: 40 }]);
    const doorSaleInvoice = (service as any).calculateDoorSaleFees(event, 40, 1);

    expect(invoice).toEqual({
      baseTotal: 40,
      lpFee: 3.19,
      processingFee: 1.6,
      total: 44.79,
    });
    expect(doorSaleInvoice).toMatchObject({ unitPrice: 40, quantity: 1, ...invoice });
  });

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

  it('sends one operational ticket copy when Tap to Pay has no buyer email', async () => {
    const transactionTicketRepo = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'ticket-1', ...value })),
    };
    const transactionOrderRepo = {
      createQueryBuilder: jest.fn(() => ({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 'order-1',
          userId: 'user-1',
          eventId: 'event-1',
          status: OrderStatus.PENDING,
          salesChannel: 'door_sale_tap_to_pay',
          seatsData: JSON.stringify([{
            seatId: '',
            sectionId: null,
            sectionName: 'Entrada en puerta',
            rowLabel: 'GA',
            seatNumber: 1,
            price: 20,
          }]),
        }),
      })),
      update: jest.fn(),
    };
    const transactionSeatRepo = { findOne: jest.fn(), update: jest.fn() };
    const manager = {
      transaction: jest.fn(async (callback: any) => callback({
        getRepository: (entity: any) => entity === Order
          ? transactionOrderRepo
          : entity === Ticket
            ? transactionTicketRepo
            : transactionSeatRepo,
      })),
    };
    const fullOrder = {
      id: 'order-1',
      userId: 'user-1',
      subtotal: 20,
      lpFee: 2.4,
      processingFee: 0.7,
      total: 23.1,
      user: { firstName: 'Venta', email: 'account@example.com' },
      event: {
        id: 'event-1',
        title: 'Evento',
        organizerId: 'organizer-1',
        organizer: { email: 'organizer@example.com' },
      },
    };
    const orderRepo = { findOne: jest.fn().mockResolvedValue(fullOrder) };
    const configService = {
      get: jest.fn((key: string) => key === 'TICKET_ARCHIVE_EMAIL' ? 'info@lpticket.com' : undefined),
    };
    const { service, mailService } = buildService({ manager, orderRepo, configService });

    await (service as any).finalizePaidOrder(
      'order-1',
      'pi_1',
      undefined,
      undefined,
      { allowFallbackEmail: false },
    );

    expect(mailService.sendTicketEmail).toHaveBeenCalledTimes(1);
    expect(transactionTicketRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: TicketStatus.USED }),
    );
    expect(mailService.sendTicketEmail).toHaveBeenCalledWith(
      'info@lpticket.com',
      'Venta',
      'Evento',
      expect.any(Array),
      expect.any(Object),
      { includeOperationalCopies: false },
    );
  });

  it('keeps a regular paid ticket active until it is scanned at the gate', async () => {
    const transactionTicketRepo = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'ticket-online-1', ...value })),
    };
    const transactionOrderRepo = {
      createQueryBuilder: jest.fn(() => ({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 'order-online-1',
          userId: 'user-1',
          eventId: 'event-1',
          status: OrderStatus.PENDING,
          salesChannel: 'online',
          seatsData: JSON.stringify([{
            seatId: '',
            sectionId: null,
            sectionName: 'General',
            rowLabel: 'GA',
            seatNumber: 1,
            price: 20,
          }]),
        }),
      })),
      update: jest.fn(),
    };
    const manager = {
      transaction: jest.fn(async (callback: any) => callback({
        getRepository: (entity: any) => entity === Order
          ? transactionOrderRepo
          : entity === Ticket
            ? transactionTicketRepo
            : { findOne: jest.fn(), update: jest.fn() },
      })),
    };
    const orderRepo = { findOne: jest.fn().mockResolvedValue(null) };
    const { service } = buildService({ manager, orderRepo });

    await (service as any).finalizePaidOrder('order-online-1', 'pi_online');

    expect(transactionTicketRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: TicketStatus.ACTIVE }),
    );
  });
});
