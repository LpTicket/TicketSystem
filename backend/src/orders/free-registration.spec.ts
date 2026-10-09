import { validate } from 'class-validator';
import { Event, EventReferral, EventStatus, Order, OrderStatus, Seat, SeatStatus, Ticket, VenueSection } from '../database/entities';
import { FreeRegistrationDto } from './dto/free-registration.dto';
import { OrdersService } from './orders.service';

const eventId = '11111111-1111-4111-8111-111111111111';
const sectionId = '22222222-2222-4222-8222-222222222222';
const requestId = '33333333-3333-4333-8333-333333333333';
const seatId = '44444444-4444-4444-8444-444444444444';
const dto = (overrides = {}): FreeRegistrationDto => ({ eventId, sectionId, requestId, quantity: 3, buyerEmail: 'qa@example.invalid', buyerName: 'QA', ...overrides });

function fixture() {
  const event: any = { id: eventId, title: 'Free QA', status: EventStatus.PUBLISHED, publicVisible: true, eventDate: new Date(Date.now() + 86400000), maxTicketsPerTransaction: 3, organizerId: 'organizer' };
  const section: any = { id: sectionId, eventId, sectionType: 'standing', name: 'General', price: 0, capacity: 3, rows: 0, seatsPerRow: 0 };
  const referral: any = { eventId, code: 'FREE100', isActive: true, discountPercent: 100, maxTickets: null };
  const state = { orders: [] as any[], tickets: [] as any[], seats: [] as any[] };
  const queries: any[] = [];
  function query(kind: string) {
    const params: any = {};
    const q: any = {
      select: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(async () => ({ usedTickets: state.orders.filter(o => o.referralCode === params.code && ['paid', 'pending'].includes(o.status)).reduce((sum, o) => sum + o.ticketCount, 0) })),
      setLock: jest.fn().mockReturnThis(), innerJoinAndSelect: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(),
      where: jest.fn((_sql, values) => { Object.assign(params, values); return q; }),
      andWhere: jest.fn((_sql, values) => { Object.assign(params, values); return q; }),
      getOne: jest.fn(async () => kind === 'event' ? event : kind === 'referral' ? (params.code === referral.code ? referral : null) : kind === 'section' ? (params.sectionId === section.id && params.eventId === section.eventId ? section : null)
        : state.orders.find(o => o.userId === params.userId && o.eventId === params.eventId && o.salesChannel === params.channel && o.seatsData.includes(params.requestId.slice(1, -1)))),
      getMany: jest.fn(async () => state.seats),
    };
    queries.push({ kind, q });
    return q;
  }
  const orders = { createQueryBuilder: jest.fn(() => query('order')), create: jest.fn(x => x), save: jest.fn(async x => { const order = { ...x, id: `order-${state.orders.length}` }; state.orders.push(order); return order; }) };
  const tickets = { create: jest.fn(x => x), save: jest.fn(async x => { state.tickets.push(x); return x; }), count: jest.fn(async () => state.tickets.filter(t => ['active', 'used'].includes(t.status)).length) };
  const seats = { createQueryBuilder: jest.fn(() => query('seat')), update: jest.fn(), find: jest.fn(async () => state.seats) };
  const repositories = new Map<any, any>([[EventReferral, { createQueryBuilder: () => query('referral') }], [Event, { createQueryBuilder: () => query('event') }], [Order, orders], [Ticket, tickets], [VenueSection, { createQueryBuilder: () => query('section') }], [Seat, seats]]);
  let queue: Promise<any> = Promise.resolve();
  const transaction = jest.fn(callback => {
    const next = queue.then(async () => {
      const beforeOrders = [...state.orders], beforeTickets = [...state.tickets];
      try { return await callback({ getRepository: (entity: any) => repositories.get(entity) }); }
      catch (error) { state.orders = beforeOrders; state.tickets = beforeTickets; throw error; }
    });
    queue = next.catch(() => undefined);
    return next;
  });
  const mail = { sendTicketEmail: jest.fn().mockResolvedValue(undefined) };
  const cache = { del: jest.fn().mockResolvedValue(undefined) };
  const service = new OrdersService({ manager: { transaction } } as any, tickets as any, seats as any, {} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    { get: jest.fn((key: string) => key === 'APP_URL' ? 'https://qa.example.invalid' : undefined) } as any, mail as any, {} as any, cache as any, {} as any);
  const stripe = { checkout: { sessions: { create: jest.fn() } }, paymentIntents: { create: jest.fn() } };
  (service as any).stripe = stripe;
  return { service, event, section, referral, state, orders, tickets, seats, mail, queries, stripe, transaction };
}

describe('Free registrations preserve paid checkout and inventory', () => {
  it('issues paid-price tickets for a 100% referral without Stripe and attributes the order', async () => {
    const f = fixture(); f.section.price = 50;
    const input = dto({ specialCode: ' free100 ' });
    const first = await f.service.registerFreeTickets('buyer', input);
    const retry = await f.service.registerFreeTickets('buyer', input);
    expect(retry.orderId).toBe(first.orderId);
    expect(f.state.orders).toHaveLength(1);
    expect(f.state.orders[0]).toMatchObject({ referralCode: 'FREE100', subtotal: 0, lpFee: 0, processingFee: 0, total: 0 });
    expect(f.state.tickets).toHaveLength(3);
    expect(f.stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
  it.each(['inactive', 'partial', 'invalid', 'limit'])('rejects unauthorized free referral issuance: %s', async kind => {
    const f = fixture(); f.section.price = 50;
    if (kind === 'inactive') f.referral.isActive = false;
    if (kind === 'partial') f.referral.discountPercent = 20;
    if (kind === 'limit') f.referral.maxTickets = 2;
    await expect(f.service.registerFreeTickets('buyer', dto({ specialCode: kind === 'invalid' ? 'OTHER' : 'FREE100' }))).rejects.toThrow();
    expect(f.state.orders).toHaveLength(0);
    expect(f.state.tickets).toHaveLength(0);
  });
  it('enforces the referral quota across competing requests and counts pending orders', async () => {
    const f = fixture(); f.section.price = 50; f.section.capacity = 20; f.referral.maxTickets = 4;
    f.state.orders.push({ ticketCount: 1, referralCode: 'FREE100', status: OrderStatus.PENDING });
    const results = await Promise.allSettled([
      f.service.registerFreeTickets('buyer-a', dto({ specialCode: 'FREE100' })),
      f.service.registerFreeTickets('buyer-b', dto({ specialCode: 'FREE100', requestId: seatId })),
    ]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(f.state.tickets).toHaveLength(3);
  });
  it('consumes a paid seat with a full discount and cannot sell it twice', async () => {
    const f = fixture();
    f.state.seats = [{ id: seatId, sectionId, section: { ...f.section, price: 75, sectionType: 'seated' }, rowLabel: 'A', seatNumber: 1, status: SeatStatus.AVAILABLE }];
    await f.service.registerFreeTickets('buyer', dto({ specialCode: 'FREE100', seatIds: [seatId], sectionId: undefined, quantity: undefined }));
    expect(f.seats.update).toHaveBeenCalledWith(expect.anything(), { status: SeatStatus.SOLD, lockedBy: null, lockExpiresAt: null });
    f.state.seats[0].status = SeatStatus.SOLD;
    await expect(f.service.registerFreeTickets('buyer-b', dto({ specialCode: 'FREE100', seatIds: [seatId], sectionId: undefined, quantity: undefined }))).rejects.toThrow();
    expect(f.state.tickets).toHaveLength(1);
  });
  it.each([1, 2, 3])('issues %s tickets and QR codes with every amount at zero, without Stripe', async quantity => {
    const f = fixture();
    const result = await f.service.registerFreeTickets('buyer', dto({ quantity }));
    expect(result).toMatchObject({ ticketCount: quantity, total: 0 });
    expect(result.url).toContain('/checkout/success?order_id=');
    expect(f.state.orders[0]).toMatchObject({ subtotal: 0, lpFee: 0, processingFee: 0, total: 0, status: OrderStatus.PAID, salesChannel: 'free_registration' });
    expect(f.state.tickets).toHaveLength(quantity);
    expect(new Set(f.state.tickets.map(t => t.ticketCode)).size).toBe(quantity);
    expect(f.state.tickets.every(t => t.price === 0 && t.qrData.startsWith('data:image/png;base64,'))).toBe(true);
    expect(f.stripe.checkout.sessions.create).not.toHaveBeenCalled();
    expect(f.stripe.paymentIntents.create).not.toHaveBeenCalled();
    expect(f.queries.find(q => q.kind === 'section').q.setLock).toHaveBeenCalledWith('pessimistic_write');
  });
  it('retries and concurrent duplicate requests return the same order without duplicate tickets or email', async () => {
    const f = fixture();
    const [a, b] = await Promise.all([f.service.registerFreeTickets('buyer', dto()), f.service.registerFreeTickets('buyer', dto())]);
    expect(a.orderId).toBe(b.orderId);
    expect(f.state.tickets).toHaveLength(3);
    expect(f.state.orders).toHaveLength(1);
    expect(f.mail.sendTicketEmail).toHaveBeenCalledTimes(1);
    expect(f.queries.filter(q => q.kind === 'event').every(q => q.q.setLock.mock.calls[0][0] === 'pessimistic_write')).toBe(true);
  });
  it('does not overbook the final places when requests compete', async () => {
    const f = fixture();
    const results = await Promise.allSettled([f.service.registerFreeTickets('buyer-a', dto()), f.service.registerFreeTickets('buyer-b', dto({ requestId: seatId }))]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(f.state.tickets).toHaveLength(3);
  });
  it.each([0, -1, 1.5, 4, 101])('rejects invalid quantity / event limit (%s)', async quantity => {
    const f = fixture();
    await expect(f.service.registerFreeTickets('buyer', dto({ quantity }))).rejects.toThrow();
    expect(f.state.orders).toHaveLength(0);
  });
  it.each([EventStatus.DRAFT, EventStatus.CANCELLED, EventStatus.COMPLETED])('rejects unavailable status %s', async status => {
    const f = fixture(); f.event.status = status;
    await expect(f.service.registerFreeTickets('buyer', dto())).rejects.toThrow();
    expect(f.state.tickets).toHaveLength(0);
  });
  it('rejects an expired event', async () => {
    const f = fixture(); f.event.eventEndDate = new Date(Date.now() - 1000);
    await expect(f.service.registerFreeTickets('buyer', dto())).rejects.toThrow();
  });
  it('cannot obtain paid tickets through the free endpoint', async () => {
    const f = fixture(); f.section.price = 50;
    await expect(f.service.registerFreeTickets('buyer', dto())).rejects.toThrow();
    expect(f.orders.save).not.toHaveBeenCalled();
  });
  it('rejects a section from another event', async () => {
    const f = fixture(); f.section.eventId = seatId;
    await expect(f.service.registerFreeTickets('buyer', dto())).rejects.toThrow();
  });
  it('preserves issuance when email delivery fails', async () => {
    const f = fixture(); f.mail.sendTicketEmail.mockRejectedValue(new Error('offline'));
    await expect(f.service.registerFreeTickets('buyer', dto())).resolves.toMatchObject({ ticketCount: 3 });
    expect(f.state.tickets).toHaveLength(3);
  });
  it('rolls back the order and all tickets if issuance fails partway', async () => {
    const f = fixture(); f.tickets.save.mockImplementationOnce(async x => { f.state.tickets.push(x); return x; }).mockRejectedValueOnce(new Error('database failure'));
    await expect(f.service.registerFreeTickets('buyer', dto())).rejects.toThrow('database failure');
    expect(f.state.orders).toHaveLength(0); expect(f.state.tickets).toHaveLength(0);
    expect(f.mail.sendTicketEmail).not.toHaveBeenCalled();
  });
  it.each(['sold', 'blocked', 'held', 'paid-override', 'paid-table-override', 'reserved', 'disabled', 'foreign-event', 'whole-table'])('rejects unavailable seated registration: %s', async kind => {
    const f = fixture();
    const section = { ...f.section, sectionType: 'table', tablePurchaseMode: 'individual', seatsConfig: '{}' };
    const seat: any = { id: seatId, sectionId, section, seatNumber: 1, rowLabel: 'GA', status: SeatStatus.AVAILABLE };
    if (kind === 'sold') seat.status = SeatStatus.SOLD;
    if (kind === 'blocked') Object.assign(seat, { status: SeatStatus.LOCKED, lockExpiresAt: null });
    if (kind === 'held') Object.assign(seat, { status: SeatStatus.LOCKED, lockedBy: 'other', lockExpiresAt: new Date(Date.now() + 60000) });
    if (kind === 'paid-override') section.seatsConfig = JSON.stringify({ 'seat-1': { price: 25 } });
    if (kind === 'paid-table-override') { seat.rowLabel = 'A'; section.seatsConfig = JSON.stringify({ 'seat-1': { price: 25 } }); }
    if (kind === 'reserved' || kind === 'disabled') section.seatsConfig = JSON.stringify({ 'seat-1': { [kind]: true } });
    if (kind === 'foreign-event') section.eventId = requestId;
    if (kind === 'whole-table') { section.tablePurchaseMode = 'whole'; f.seats.find.mockResolvedValue([seat, { ...seat, id: requestId, seatNumber: 2 }]); }
    f.state.seats = [seat];
    await expect(f.service.registerFreeTickets('buyer', dto({ seatIds: [seatId], quantity: undefined, sectionId: undefined }))).rejects.toThrow();
    expect(f.state.tickets).toHaveLength(0); expect(f.seats.update).not.toHaveBeenCalled();
  });
  it.each(['seated', 'vip'])('issues an available free %s seat and consumes it atomically', async sectionType => {
    const f = fixture();
    f.state.seats = [{ id: seatId, sectionId, section: { ...f.section, sectionType }, rowLabel: 'A', seatNumber: 1, status: SeatStatus.AVAILABLE }];
    await f.service.registerFreeTickets('buyer', dto({ seatIds: [seatId], quantity: undefined, sectionId: undefined }));
    expect(f.seats.update).toHaveBeenCalledWith(expect.anything(), { status: SeatStatus.SOLD, lockedBy: null, lockExpiresAt: null });
    expect(f.queries.find(q => q.kind === 'seat').q.setLock).toHaveBeenCalledWith('pessimistic_write', undefined, ['seat', 'section']);
  });
  it('validates untrusted identifiers and quantity before the controller calls the service', async () => {
    expect(await validate(Object.assign(new FreeRegistrationDto(), dto()))).toHaveLength(0);
    const errors = await validate(Object.assign(new FreeRegistrationDto(), dto({ requestId: 'sql-injection', quantity: 1.5, seatIds: [seatId, seatId] })));
    expect(errors.map(e => e.property)).toEqual(expect.arrayContaining(['requestId', 'quantity', 'seatIds']));
  });
  it('does not reuse a completed request ID for a different quantity', async () => {
    const f = fixture(); await f.service.registerFreeTickets('buyer', dto());
    await expect(f.service.registerFreeTickets('buyer', dto({ quantity: 1 }))).rejects.toThrow('otras entradas');
    expect(f.state.tickets).toHaveLength(3);
  });
  it('scopes a registration confirmation to both the authenticated buyer and order', async () => {
    const f = fixture();
    const query: any = { leftJoin: jest.fn().mockReturnThis(), addSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), take: jest.fn().mockReturnThis(), getManyAndCount: jest.fn().mockResolvedValue([[], 0]) };
    (f.service as any).ticketRepo.createQueryBuilder = jest.fn(() => query);
    await f.service.getUserTickets('buyer', undefined, 1, 100, 'other-order');
    expect(query.where).toHaveBeenCalledWith('t.userId = :userId', { userId: 'buyer' });
    expect(query.andWhere).toHaveBeenCalledWith('t.orderId = :registrationOrderId', { registrationOrderId: 'other-order' });
  });
});
