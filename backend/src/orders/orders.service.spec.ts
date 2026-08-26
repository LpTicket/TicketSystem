import {
  Event,
  Order,
  OrderStatus,
  Seat,
  SeatStatus,
  Ticket,
  TicketRevocation,
  TicketRevocationSeatAction,
  TicketStatus,
  UserRole,
  VenueSection,
} from '../database/entities';
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
  function buildRevocationTransaction(tickets: any[], seats: any[], sections: any[]) {
    const eventQuery = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({ id: 'event-1', organizerId: 'organizer-1' }),
    };
    const ticketQuery = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(tickets),
    };
    const seatQuery = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(seats),
    };
    const sectionQuery = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(sections),
    };
    const repositories = {
      event: { createQueryBuilder: jest.fn(() => eventQuery) },
      ticket: { createQueryBuilder: jest.fn(() => ticketQuery), save: jest.fn(async (value) => value) },
      seat: { createQueryBuilder: jest.fn(() => seatQuery), save: jest.fn(async (value) => value) },
      section: { createQueryBuilder: jest.fn(() => sectionQuery), save: jest.fn(async (value) => value) },
      revocation: {
        create: jest.fn((value) => ({ id: 'audit-1', ...value })),
        save: jest.fn(async (value) => value),
      },
    };
    const manager = {
      transaction: jest.fn(async (callback: any) => callback({
        getRepository: (entity: any) => entity === Event
          ? repositories.event
          : entity === Ticket
            ? repositories.ticket
            : entity === Seat
              ? repositories.seat
              : entity === VenueSection
                ? repositories.section
                : entity === TicketRevocation
                  ? repositories.revocation
                  : {},
      })),
    };
    return { manager, repositories };
  }

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

  it('applies the fixed service fee once per ticket and the Stripe fixed fee once per order', () => {
    const { service } = buildService();
    const invoice = (service as any).calculateOrderFees(
      { maxTicketsPerTransaction: 30, serviceFeePercent: 0.5, processingFeePercent: 0.5 },
      [{ price: 40 }, { price: 40 }],
    );

    expect(invoice).toEqual({
      baseTotal: 80,
      lpFee: 6.38,
      processingFee: 2.89,
      total: 89.27,
    });
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

  it('denies a revoked QR without changing it, preserving the current scanner Denegado flow', async () => {
    const { service, ticketRepo } = buildService();
    ticketRepo.findOne.mockResolvedValue({
      id: 'ticket-revoked',
      eventId: 'event-1',
      status: TicketStatus.REVOKED,
      event: { organizerId: 'organizer-1' },
    });

    const result = await service.validateTicket('REVOKED-CODE', { id: 'organizer-1', role: UserRole.CLIENT });

    expect(result).toMatchObject({ valid: false, reason: 'revoked' });
    expect(ticketRepo.update).not.toHaveBeenCalled();
  });

  it('revokes one ticket and releases its seat atomically', async () => {
    const section = {
      id: 'section-1',
      eventId: 'event-1',
      sectionType: 'seated',
      seatsConfig: JSON.stringify({ 'A-1': { reserved: true, status: 'reserved' } }),
    };
    const seat = {
      id: 'seat-1',
      sectionId: section.id,
      rowLabel: 'A',
      seatNumber: 1,
      status: SeatStatus.SOLD,
      lockedBy: null,
      lockExpiresAt: null,
    };
    const ticket = {
      id: 'ticket-1',
      ticketCode: 'CODE-1',
      eventId: 'event-1',
      userId: 'buyer-1',
      seatId: seat.id,
      status: TicketStatus.ACTIVE,
    };
    const { manager, repositories } = buildRevocationTransaction([ticket], [seat], [section]);
    const { service } = buildService({ manager });

    const result = await service.revokeEventTickets(
      'event-1',
      { ticketIds: [ticket.id], seatAction: TicketRevocationSeatAction.RELEASE, reason: 'Solicitud confirmada' },
      { id: 'organizer-1', role: UserRole.CLIENT },
    );

    expect(manager.transaction).toHaveBeenCalledTimes(1);
    expect(ticket.status).toBe(TicketStatus.REVOKED);
    expect(seat.status).toBe(SeatStatus.AVAILABLE);
    expect(seat.lockedBy).toBeNull();
    expect(JSON.parse(section.seatsConfig)['A-1']).toBeUndefined();
    expect(repositories.revocation.save).toHaveBeenCalledWith(expect.objectContaining({
      revokedByUserId: 'organizer-1',
      ticketIds: ['ticket-1'],
      seatIds: ['seat-1'],
      reason: 'Solicitud confirmada',
    }));
    expect(result).toMatchObject({ revoked: 1, affectedSeats: 1, seatAction: 'release' });
  });

  it('revokes all selected tickets and keeps every seat permanently blocked', async () => {
    const section = { id: 'section-1', eventId: 'event-1', sectionType: 'seated', seatsConfig: '{}' };
    const seats = [1, 2].map((seatNumber) => ({
      id: `seat-${seatNumber}`,
      sectionId: section.id,
      rowLabel: 'A',
      seatNumber,
      status: SeatStatus.SOLD,
      lockedBy: null,
      lockExpiresAt: null,
    }));
    const tickets = seats.map((seat, index) => ({
      id: `ticket-${index + 1}`,
      ticketCode: `CODE-${index + 1}`,
      eventId: 'event-1',
      userId: 'buyer-1',
      seatId: seat.id,
      status: index === 0 ? TicketStatus.ACTIVE : TicketStatus.USED,
    }));
    const { manager, repositories } = buildRevocationTransaction(tickets, seats, [section]);
    const { service } = buildService({ manager });

    const result = await service.revokeEventTickets(
      'event-1',
      { ticketIds: tickets.map((ticket) => ticket.id), seatAction: TicketRevocationSeatAction.BLOCK, reason: 'Reemplazo por invitación' },
      { id: 'organizer-1', role: UserRole.CLIENT },
    );

    expect(tickets.every((ticket) => ticket.status === TicketStatus.REVOKED)).toBe(true);
    expect(seats.every((seat) => seat.status === SeatStatus.LOCKED && seat.lockedBy === 'organizer-1' && seat.lockExpiresAt === null)).toBe(true);
    expect(JSON.parse(section.seatsConfig)).toMatchObject({
      'A-1': { reserved: true, status: 'reserved' },
      'A-2': { reserved: true, status: 'reserved' },
    });
    expect(repositories.revocation.save).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ revoked: 2, affectedSeats: 2, seatAction: 'block' });
  });

  it('does not create a duplicate revocation when all selected tickets are already revoked', async () => {
    const ticket = {
      id: 'ticket-1', ticketCode: 'CODE-1', eventId: 'event-1', userId: 'buyer-1', seatId: 'seat-1', status: TicketStatus.REVOKED,
    };
    const { manager, repositories } = buildRevocationTransaction([ticket], [], []);
    const { service } = buildService({ manager });

    const result = await service.revokeEventTickets(
      'event-1',
      { ticketIds: [ticket.id], seatAction: TicketRevocationSeatAction.RELEASE, reason: 'Intento repetido' },
      { id: 'organizer-1', role: UserRole.CLIENT },
    );

    expect(result).toMatchObject({ alreadyRevoked: true, revoked: 0 });
    expect(repositories.revocation.save).not.toHaveBeenCalled();
  });

  it('rejects a revocation requested by a user who does not own the event', async () => {
    const ticket = {
      id: 'ticket-1', ticketCode: 'CODE-1', eventId: 'event-1', userId: 'buyer-1', seatId: 'seat-1', status: TicketStatus.ACTIVE,
    };
    const { manager, repositories } = buildRevocationTransaction([ticket], [], []);
    const { service } = buildService({ manager });

    await expect(service.revokeEventTickets(
      'event-1',
      { ticketIds: [ticket.id], seatAction: TicketRevocationSeatAction.RELEASE, reason: 'Sin autorización' },
      { id: 'another-organizer', role: UserRole.CLIENT },
    )).rejects.toThrow('No tienes permiso');

    expect(repositories.ticket.save).not.toHaveBeenCalled();
    expect(repositories.revocation.save).not.toHaveBeenCalled();
  });

  it('never resends a revoked ticket', async () => {
    const { service, ticketRepo, mailService } = buildService();
    ticketRepo.findOne.mockResolvedValue({ id: 'ticket-1', ticketCode: 'CODE-1', status: TicketStatus.REVOKED });

    await expect(service.resendTicketEmailByCode('CODE-1', 'buyer-1')).rejects.toThrow('no se puede reenviar');
    expect(mailService.sendTicketEmail).not.toHaveBeenCalled();
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

  it('offers Klarna only in eligible web checkout currencies and supports an immediate rollback flag', () => {
    const enabled = buildService();
    expect((enabled.service as any).getWebCheckoutPaymentMethodTypes('usd')).toEqual(['card', 'klarna']);
    expect((enabled.service as any).getWebCheckoutPaymentMethodTypes('usd', 'card')).toEqual(['card']);
    expect((enabled.service as any).getWebCheckoutPaymentMethodTypes('usd', 'klarna')).toEqual(['klarna']);
    expect(() => (enabled.service as any).getWebCheckoutPaymentMethodTypes('usd', 'invalid'))
      .toThrow('Método de pago no válido.');
    expect((enabled.service as any).getWebCheckoutPaymentMethodTypes('mxn')).toEqual(['card']);
    expect(() => (enabled.service as any).getWebCheckoutPaymentMethodTypes('mxn', 'klarna'))
      .toThrow('Klarna no está disponible para la moneda de este evento. Puedes pagar con tarjeta.');

    const disabled = buildService({
      configService: { get: jest.fn((key: string) => key === 'KLARNA_WEB_ENABLED' ? 'false' : undefined) },
    });
    expect((disabled.service as any).getWebCheckoutPaymentMethodTypes('usd')).toEqual(['card']);
    expect(() => (disabled.service as any).getWebCheckoutPaymentMethodTypes('usd', 'klarna'))
      .toThrow('Klarna no está disponible para la moneda de este evento. Puedes pagar con tarjeta.');
  });

  it('does not issue tickets when Checkout completes before a delayed payment is paid', async () => {
    const { service } = buildService();
    const finalize = jest.spyOn(service as any, 'finalizePaidCheckoutSession').mockResolvedValue(undefined);

    await service.handleStripeWebhook({
      type: 'checkout.session.completed',
      data: { object: { mode: 'payment', payment_status: 'unpaid', metadata: { orderId: 'order-1' } } },
    });

    expect(finalize).not.toHaveBeenCalled();
  });

  it('deducts only Klarna processing cost above the standard card baseline from the organizer', async () => {
    const orderRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'order-klarna-1',
        total: 100,
        salesChannel: 'online',
      }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const { service } = buildService({ orderRepo });
    (service as any).stripe = {
      paymentIntents: {
        retrieve: jest.fn().mockResolvedValue({
          id: 'pi_klarna',
          payment_method: { type: 'klarna' },
          latest_charge: {
            id: 'ch_klarna',
            payment_method_details: { type: 'klarna' },
            balance_transaction: { id: 'txn_klarna', fee: 600 },
          },
        }),
      },
    };

    await (service as any).reconcileStripeFee('order-klarna-1', 'pi_klarna');

    expect(orderRepo.update).toHaveBeenCalledWith('order-klarna-1', expect.objectContaining({
      paymentMethodType: 'klarna',
      actualStripeFee: 6,
      standardCardFee: 3.2,
      organizerProcessingAdjustment: 2.8,
      stripeFeeReconciliationStatus: 'reconciled',
    }));
  });

  it('does not change organizer payout accounting for ordinary card payments', async () => {
    const orderRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'order-card-1',
        total: 100,
        salesChannel: 'online',
      }),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const { service } = buildService({ orderRepo });
    (service as any).stripe = {
      paymentIntents: {
        retrieve: jest.fn().mockResolvedValue({
          id: 'pi_card',
          payment_method: { type: 'card' },
          latest_charge: {
            id: 'ch_card',
            payment_method_details: { type: 'card' },
            balance_transaction: { id: 'txn_card', fee: 320 },
          },
        }),
      },
    };

    await (service as any).reconcileStripeFee('order-card-1', 'pi_card');

    expect(orderRepo.update).toHaveBeenCalledWith('order-card-1', expect.objectContaining({
      paymentMethodType: 'card',
      organizerProcessingAdjustment: 0,
      stripeFeeReconciliationStatus: 'not_required',
    }));
  });
});
