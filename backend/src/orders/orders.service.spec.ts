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
  const cache = overrides.cache || { del: jest.fn(), get: jest.fn(), set: jest.fn() };
  const service = new OrdersService(
    orderRepo as any,
    ticketRepo as any,
    (overrides.seatRepo || {}) as any,
    eventRepo as any,
    (overrides.sectionRepo || {}) as any,
    (overrides.specialCodeRepo || {}) as any,
    (overrides.scannerAccessRepo || {}) as any,
    (overrides.paymentMethodRepo || {}) as any,
    (overrides.organizerPayoutRepo || {}) as any,
    (overrides.configService || { get: jest.fn(() => undefined) }) as any,
    mailService as any,
    ({ sendTransactionalSms: jest.fn() }) as any,
    cache as any,
  );
  return { service, ticketRepo, eventRepo, orderRepo, mailService, cache };
}

describe('OrdersService critical ticket safeguards', () => {
  it('keeps sold, courtesy, blocked, held and available inventory mutually exclusive', () => {
    const { service } = buildService();
    const future = new Date(Date.now() + 60_000);
    const inventory = (service as any).buildEventInventorySummary(
      [{ id: 'section-1', sectionType: 'seating', rows: 1, seatsPerRow: 10 }],
      [
        { id: 'seat-paid', sectionId: 'section-1', status: SeatStatus.SOLD },
        { id: 'seat-courtesy', sectionId: 'section-1', status: SeatStatus.LOCKED },
        { id: 'seat-blocked', sectionId: 'section-1', status: SeatStatus.LOCKED, lockExpiresAt: null },
        { id: 'seat-held', sectionId: 'section-1', status: SeatStatus.LOCKED, lockExpiresAt: future },
        ...Array.from({ length: 6 }, (_, index) => ({
          id: `seat-available-${index}`,
          sectionId: 'section-1',
          status: SeatStatus.AVAILABLE,
        })),
      ],
      [
        { id: 'ticket-paid', orderId: 'order-paid', seatId: 'seat-paid', status: TicketStatus.ACTIVE, price: 25 },
        { id: 'ticket-courtesy', orderId: 'order-courtesy', seatId: 'seat-courtesy', status: TicketStatus.ACTIVE, price: 0 },
      ],
      [
        { id: 'order-paid', total: 25, salesChannel: 'web' },
        { id: 'order-courtesy', total: 0, salesChannel: 'complimentary' },
      ],
    );

    expect(inventory).toEqual({
      totalCapacity: 10,
      soldTickets: 1,
      courtesyTickets: 1,
      blockedTickets: 1,
      heldTickets: 1,
      availableTickets: 6,
    });
  });

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

  it('shows recorded payouts and the real organizer balance without subtracting Stripe again', async () => {
    const query = (one?: any, many?: any[]) => ({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue(one),
      getRawMany: jest.fn().mockResolvedValue(many || []),
    });
    const revenueQuery = query({
      totalRevenue: '5140.00',
      totalCharged: '5609.31',
      organizerProcessingAdjustments: '200.00',
      pendingFeeReconciliations: '0',
      totalTickets: '162',
      totalOrders: '51',
    });
    const dayQuery = query(undefined, [{ date: '2026-09-15', orders: '2', tickets: '6', revenue: '360.00' }]);
    const checkinQuery = query({ scanned: '10', pending: '152' });
    const payoutQuery = query({ organizerPaid: '1000.00' });
    const cache = { del: jest.fn(), get: jest.fn().mockResolvedValue(null), set: jest.fn() };
    const { service } = buildService({
      orderRepo: { createQueryBuilder: jest.fn().mockReturnValueOnce(revenueQuery).mockReturnValueOnce(dayQuery) },
      ticketRepo: { createQueryBuilder: jest.fn().mockReturnValue(checkinQuery) },
      organizerPayoutRepo: { createQueryBuilder: jest.fn().mockReturnValue(payoutQuery) },
      cache,
    });

    const stats = await service.getOrganizerStats('organizer-1');

    expect(stats).toMatchObject({
      totalRevenue: 5140,
      organizerProcessingAdjustments: 200,
      organizerPaid: 1000,
      organizerPending: 3940,
    });
    expect(stats).not.toHaveProperty('netEstimated');
    expect(cache.set).toHaveBeenCalledWith('organizer:stats:organizer-1', expect.objectContaining({
      organizerPending: 3940,
    }), 30_000);
  });

  it('issues general-admission courtesy tickets without creating revenue', async () => {
    const sectionQuery = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 'section-1',
        eventId: 'event-1',
        name: 'General VIP',
        sectionType: 'standing',
        capacity: 20,
        rows: 0,
        seatsPerRow: 0,
      }),
    };
    const transactionTicketRepo = {
      count: jest.fn().mockResolvedValue(7),
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: `ticket-${Math.random()}`, ...value })),
    };
    const transactionOrderRepo = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => ({ id: 'courtesy-order-1', ...value })),
    };
    const manager = {
      transaction: jest.fn(async (callback: any) => callback({
        getRepository: (entity: any) => entity === VenueSection
          ? { createQueryBuilder: jest.fn(() => sectionQuery) }
          : entity === Ticket
            ? transactionTicketRepo
            : entity === Order
              ? transactionOrderRepo
              : {},
      })),
    };
    const recipient = { id: 'guest-1', email: 'guest@example.com', firstName: 'Maria', lastName: 'Lopez' };
    const eventRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'event-1',
        title: 'Evento Premium',
        organizerId: 'organizer-1',
        organizer: { email: 'guest@example.com' },
      }),
      manager: {
        findOne: jest.fn().mockResolvedValue(recipient),
        create: jest.fn(),
        save: jest.fn(),
      },
    };
    const mailService = { sendTicketEmail: jest.fn().mockResolvedValue(undefined) };
    const { service } = buildService({ manager, eventRepo, mailService });

    const result = await service.issueFreeTickets('event-1', {
      sectionId: 'section-1',
      quantity: 3,
      name: 'Maria Lopez',
      email: 'guest@example.com',
      courtesyType: 'sponsor',
      note: 'Sponsor principal',
    }, 'organizer-1');

    expect(result).toMatchObject({ success: true, count: 3, orderId: 'courtesy-order-1', emailSent: true });
    expect(transactionOrderRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      subtotal: 0,
      total: 0,
      ticketCount: 3,
      salesChannel: 'complimentary',
    }));
    const savedOrderInput = transactionOrderRepo.create.mock.calls[0][0];
    expect(JSON.parse(savedOrderInput.seatsData)[0]).toMatchObject({
      sectionId: 'section-1',
      courtesyType: 'sponsor',
      note: 'Sponsor principal',
      recipientName: 'Maria Lopez',
      issuedBy: 'organizer-1',
    });
    expect(transactionTicketRepo.save).toHaveBeenCalledTimes(3);
    expect(transactionTicketRepo.create).toHaveBeenCalledWith(expect.objectContaining({
      sectionId: 'section-1',
      seatId: null,
      price: 0,
      status: TicketStatus.ACTIVE,
    }));
    expect(mailService.sendTicketEmail).toHaveBeenCalledTimes(1);
    expect(mailService.sendTicketEmail).toHaveBeenCalledWith(
      'guest@example.com',
      'Maria Lopez',
      'Evento Premium',
      expect.arrayContaining([expect.objectContaining({ sectionId: 'section-1' })]),
      expect.objectContaining({
        currency: 'USD',
        subtotal: 0,
        total: 0,
        courtesyType: 'sponsor',
        attendeeName: 'Maria Lopez',
        courtesyNote: 'Sponsor principal',
      }),
    );
  });

  it('does not issue a general courtesy beyond the remaining capacity', async () => {
    const sectionQuery = {
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 'section-1', eventId: 'event-1', name: 'General', sectionType: 'standing', capacity: 10, rows: 0, seatsPerRow: 0,
      }),
    };
    const transactionOrderRepo = { create: jest.fn(), save: jest.fn() };
    const manager = {
      transaction: jest.fn(async (callback: any) => callback({
        getRepository: (entity: any) => entity === VenueSection
          ? { createQueryBuilder: jest.fn(() => sectionQuery) }
          : entity === Ticket
            ? { count: jest.fn().mockResolvedValue(9) }
            : entity === Order
              ? transactionOrderRepo
              : {},
      })),
    };
    const eventRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'event-1', title: 'Evento', organizerId: 'organizer-1', organizer: {} }),
      manager: { findOne: jest.fn().mockResolvedValue({ id: 'guest-1' }) },
    };
    const { service } = buildService({ manager, eventRepo });

    await expect(service.issueFreeTickets('event-1', {
      sectionId: 'section-1', quantity: 2, name: 'Invitado', email: 'guest@example.com',
    }, 'organizer-1')).rejects.toThrow('Quedan 1');
    expect(transactionOrderRepo.save).not.toHaveBeenCalled();
  });

  it('allows only the owning organizer to open a receipt for their event', async () => {
    const order = {
      id: 'courtesy-order-1',
      userId: 'guest-1',
      salesChannel: 'complimentary',
      seatsData: JSON.stringify([{ recipientName: 'Maria Lopez', courtesyType: 'press' }]),
      event: { organizerId: 'organizer-1' },
    };
    const { service } = buildService({
      orderRepo: { findOne: jest.fn().mockResolvedValue(order) },
      ticketRepo: { find: jest.fn().mockResolvedValue([]) },
    });

    await expect(service.getOrderById('courtesy-order-1', { id: 'organizer-1', role: 'client' }))
      .resolves.toMatchObject({ isCourtesy: true, courtesyRecipientName: 'Maria Lopez', courtesyType: 'press' });
    await expect(service.getOrderById('courtesy-order-1', { id: 'other-user', role: 'client' }))
      .rejects.toThrow('No tienes permiso para ver este recibo');
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

  it('sends one order email when several ticket resend requests arrive together', async () => {
    const persistedOrder: any = {
      id: 'order-1',
      userId: 'buyer-1',
      ticketDeliveryLog: null,
    };
    const lockedOrderRepo = {
      createQueryBuilder: jest.fn(() => ({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn(async () => ({ ...persistedOrder })),
      })),
      update: jest.fn(async (_id: string, values: any) => Object.assign(persistedOrder, values)),
    };
    let transactionQueue = Promise.resolve<any>(undefined);
    const manager = {
      transaction: jest.fn((callback: any) => {
        const result = transactionQueue.then(() => callback({
          getRepository: (entity: any) => entity === Order ? lockedOrderRepo : {},
        }));
        transactionQueue = result.then(() => undefined, () => undefined);
        return result;
      }),
    };
    const fullOrder = {
      ...persistedOrder,
      user: { firstName: 'Mariana', email: 'buyer@example.com' },
      event: {
        title: 'Evento',
        organizerId: 'organizer-1',
        organizer: { email: 'organizer@example.com' },
      },
    };
    const orderRepo = { manager, findOne: jest.fn().mockResolvedValue(fullOrder) };
    const ticketRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 'ticket-1', ticketCode: 'CODE-1', orderId: 'order-1', status: TicketStatus.ACTIVE,
      }),
      find: jest.fn().mockResolvedValue(Array.from({ length: 5 }, (_, index) => ({
        id: `ticket-${index + 1}`, orderId: 'order-1', status: TicketStatus.ACTIVE,
      }))),
    };
    const mailService = { sendTicketEmail: jest.fn().mockResolvedValue({ messageId: 'message-1' }) };
    const { service } = buildService({ orderRepo, manager, ticketRepo, mailService });

    const results = await Promise.all(Array.from({ length: 5 }, () =>
      service.resendTicketEmailByCode('CODE-1', 'buyer-1')));

    expect(mailService.sendTicketEmail).toHaveBeenCalledTimes(1);
    expect(mailService.sendTicketEmail).toHaveBeenCalledWith(
      'buyer@example.com',
      'Mariana',
      'Evento',
      expect.arrayContaining([expect.objectContaining({ id: 'ticket-1' })]),
      expect.any(Object),
      { includeOperationalCopies: false },
    );
    expect(results.filter((result) => result.alreadySent === false)).toHaveLength(1);
    expect(results.filter((result) => result.alreadySent === true)).toHaveLength(4);
    const deliveryHistory = JSON.parse(persistedOrder.ticketDeliveryLog);
    expect(deliveryHistory).toEqual([
      expect.objectContaining({ channel: 'email', source: 'manual', status: 'sent' }),
    ]);
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
    // A slow SMTP response must not hold the confirmed gate admission open.
    mailService.sendTicketEmail.mockImplementation(() => new Promise<void>(() => {}));

    await (service as any).finalizePaidOrder(
      'order-1',
      'pi_1',
      undefined,
      undefined,
      { allowFallbackEmail: false },
    );

    await new Promise((resolve) => setImmediate(resolve));
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

  it('uses TypeORM property paths when retrying pending Klarna fees', async () => {
    const pendingQuery = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    const orderRepo = {
      createQueryBuilder: jest.fn(() => pendingQuery),
    };
    const { service } = buildService({ orderRepo });
    (service as any).stripe = {};

    await (service as any).reconcilePendingStripeFees();

    expect(pendingQuery.andWhere).toHaveBeenNthCalledWith(
      1,
      'pendingOrder.stripeFeeReconciliationStatus = :reconciliationStatus',
      { reconciliationStatus: 'pending' },
    );
    expect(pendingQuery.andWhere).toHaveBeenNthCalledWith(
      2,
      'pendingOrder.stripePaymentIntent IS NOT NULL',
    );
    expect(pendingQuery.orderBy).toHaveBeenCalledWith('pendingOrder.paidAt', 'ASC');
  });
});

describe('Gate admission and confirmed Tap to Pay', () => {
  const actor = { id: 'admin-1', role: UserRole.ADMIN };
  function paymentService(status = 'succeeded') {
    const order = { id: 'order-1', eventId: 'event-1', userId: actor.id, total: 44.79, ticketCount: 1,
      stripePaymentIntent: 'pi_test', salesChannel: 'door_sale_tap_to_pay', event: { currency: 'USD' } };
    const pi = { id: 'pi_test', status, amount: 4479, currency: 'usd', client_secret: 'test-only',
      metadata: { orderId: order.id, eventId: order.eventId, source: 'door_sale_tap_to_pay' } };
    const { service } = buildService({ orderRepo: { findOne: jest.fn().mockResolvedValue(order), update: jest.fn().mockResolvedValue({ affected: 1 }) } });
    const stripe = { paymentIntents: { retrieve: jest.fn().mockResolvedValue(pi), capture: jest.fn(), cancel: jest.fn() } };
    (service as any).stripe = stripe;
    const fulfill = jest.spyOn(service as any, 'finalizePaidOrder').mockResolvedValue([{ id: 'ticket-1' }]);
    return { service, stripe, fulfill, pi, order };
  }

  it('records operator, time and manual method in the same conditional ticket update', async () => {
    const { service, ticketRepo } = buildService();
    ticketRepo.findOne.mockResolvedValue({ id: 'ticket-1', eventId: 'event-1', status: TicketStatus.ACTIVE });
    ticketRepo.update.mockResolvedValue({ affected: 1 });
    const result = await service.validateTicket('CODE', actor, { admissionMethod: 'manual' });
    expect(result.valid).toBe(true);
    expect(ticketRepo.update).toHaveBeenCalledWith({ id: 'ticket-1', status: TicketStatus.ACTIVE }, {
      status: TicketStatus.USED, usedAt: expect.any(Date), usedBy: actor.id, admissionMethod: 'manual',
    });
  });

  it('admits only once when two gates race for the last ticket', async () => {
    const { service, ticketRepo } = buildService();
    ticketRepo.findOne.mockImplementation(async () => ({ id: 'ticket-1', status: TicketStatus.ACTIVE }));
    let active = true;
    ticketRepo.update.mockImplementation(async () => { const affected = active ? 1 : 0; active = false; return { affected }; });
    const results = await Promise.all([service.validateTicket('CODE', actor), service.validateTicket('CODE', actor)]);
    expect(results.filter((r) => r.valid)).toHaveLength(1);
  });

  it('loads complete buyer balances after a code match and counts only active tickets as available', async () => {
    const query: any = {};
    for (const name of ['leftJoin', 'select', 'distinct', 'where', 'andWhere', 'orderBy', 'limit']) query[name] = jest.fn(() => query);
    query.getRawMany = jest.fn().mockResolvedValue([{ buyerId: 'buyer-1' }]);
    const tickets = ['active', 'used', 'revoked', 'cancelled'].map((status, index) => ({ ticketCode: `CODE${index}`, status, user: { id: 'buyer-1', firstName: 'María', lastName: 'López' } }));
    const { service, ticketRepo } = buildService({ ticketRepo: { createQueryBuilder: jest.fn(() => query), find: jest.fn().mockResolvedValue(tickets) } });
    jest.spyOn(service as any, 'assertEventAccess').mockResolvedValue(undefined);
    const [buyer] = await service.searchEventTicketsGrouped('event-1', 'CODE0', actor);
    expect(buyer).toMatchObject({ ticketCount: 4, scannedCount: 1, availableCount: 1, unavailableCount: 2 });
    expect(ticketRepo.find).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ eventId: 'event-1', userId: expect.anything() }) }));
  });

  it.each(['processing', 'requires_payment_method', 'requires_confirmation', 'requires_action', 'canceled'])('never fulfills or approves %s', async (status) => {
    const { service, fulfill } = paymentService(status);
    const result = await service.completeDoorSaleTapToPay(actor, 'order-1', 'pi_test', { returnPending: true });
    expect(result).toMatchObject({ success: false, paymentStatus: status });
    expect(fulfill).not.toHaveBeenCalled();
  });

  it('keeps non-success responses out of the legacy completion contract', async () => {
    const { service, fulfill } = paymentService('processing');
    await expect(service.completeDoorSaleTapToPay(actor, 'order-1', 'pi_test')).rejects.toThrow('pendiente');
    expect(fulfill).not.toHaveBeenCalled();
  });

  it('requires succeeded after capture, not just a successful capture HTTP response', async () => {
    const { service, stripe, fulfill, pi } = paymentService('requires_capture');
    stripe.paymentIntents.capture.mockResolvedValue({ ...pi, status: 'processing' });
    const result = await service.completeDoorSaleTapToPay(actor, 'order-1', 'pi_test', { returnPending: true });
    expect(result.success).toBe(false);
    expect(fulfill).not.toHaveBeenCalled();
  });

  it('approves only a succeeded payment with all issued tickets', async () => {
    const { service, fulfill } = paymentService();
    expect(await service.completeDoorSaleTapToPay(actor, 'order-1', 'pi_test')).toMatchObject({ success: true, paymentStatus: 'succeeded', ticketCount: 1 });
    fulfill.mockResolvedValue([]);
    await expect(service.completeDoorSaleTapToPay(actor, 'order-1', 'pi_test')).rejects.toThrow('entradas pendientes');
  });

  it('rejects wrong amount or wrong order before fulfillment', async () => {
    const { service, fulfill, pi } = paymentService();
    pi.amount = 1;
    await expect(service.completeDoorSaleTapToPay(actor, 'order-1', 'pi_test')).rejects.toThrow('no coincide');
    expect(fulfill).not.toHaveBeenCalled();
    await expect(service.completeDoorSaleTapToPay(actor, 'order-1', 'pi_other')).rejects.toThrow('does not match');
  });

  it('does not cancel a payment that completed while cancellation was in flight', async () => {
    const { service, stripe, pi } = paymentService('requires_confirmation');
    stripe.paymentIntents.cancel.mockRejectedValue(new Error('already completed'));
    stripe.paymentIntents.retrieve.mockResolvedValueOnce(pi).mockResolvedValue({ ...pi, status: 'succeeded' });
    expect(await service.completeDoorSaleTapToPay(actor, 'order-1', 'pi_test', { returnPending: true, cancel: true })).toMatchObject({ success: true });
  });

  it('denies an employee without an active grant before contacting Stripe', async () => {
    const { service, stripe } = paymentService('requires_payment_method');
    (service as any).scannerAccessRepo = { findOne: jest.fn().mockResolvedValue(null) };
    await expect(service.completeDoorSaleTapToPay({ id: actor.id, role: UserRole.CLIENT }, 'order-1', 'pi_test', { returnPending: true, cancel: true })).rejects.toThrow('permission');
    expect(stripe.paymentIntents.retrieve).not.toHaveBeenCalled();
  });

  it('denies cancellation of another employee order even with an event grant', async () => {
    const { service, stripe } = paymentService('requires_payment_method');
    (service as any).scannerAccessRepo = { findOne: jest.fn().mockResolvedValue({ id: 'grant-1' }) };
    await expect(service.completeDoorSaleTapToPay({ id: 'other-employee', role: UserRole.CLIENT }, 'order-1', 'pi_test', { returnPending: true, cancel: true })).rejects.toThrow('permission');
    expect(stripe.paymentIntents.retrieve).not.toHaveBeenCalled();
  });

  it('confirms cancellation before allowing a new purchase', async () => {
    const { service, stripe, fulfill, pi } = paymentService('requires_payment_method');
    stripe.paymentIntents.cancel.mockResolvedValue({ ...pi, status: 'canceled' });
    expect(await service.completeDoorSaleTapToPay(actor, 'order-1', 'pi_test', { returnPending: true, cancel: true })).toMatchObject({ success: false, cancelled: true });
    expect((service as any).orderRepo.update).toHaveBeenCalledWith(
      { id: 'order-1', stripePaymentIntent: 'pi_test', status: OrderStatus.PENDING },
      { status: OrderStatus.CANCELLED },
    );
    expect(fulfill).not.toHaveBeenCalled();
  });
});
