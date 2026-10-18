import { Event, Order, OrderStatus } from '../database/entities';
import { organizerDisputeAdjustment } from '../common/utils/order-disputes';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { AdminController } from '../admin/admin.controller';
import { AdminService } from '../admin/admin.service';

const eventId = 'efcd3cb0-3db0-4f12-9724-ad3b4bc168c2';

function setup() {
  const order: any = { id: 'order-1', eventId, userId: 'buyer', status: OrderStatus.PAID,
    subtotal: 70, total: 76.62, stripePaymentIntent: 'pi_1', stripeDisputes: {}, organizerDisputeAdjustment: 0 };
  const event = { id: eventId, organizerId: 'organizer', currency: 'USD' };
  const transactionalOrders = { findOne: jest.fn(async () => order),
    update: jest.fn(async (_id, patch) => { Object.assign(order, patch); }) };
  const eventRepo = { findOne: jest.fn().mockResolvedValue(event) };
  const manager = { transaction: jest.fn(async callback => callback({
    getRepository: entity => entity === Event ? eventRepo : transactionalOrders,
  })) };
  const orderRepo = { findOne: jest.fn(async () => order), manager };
  const cache = { del: jest.fn(), get: jest.fn(), set: jest.fn() };
  const service = new OrdersService(orderRepo as any, {} as any, {} as any, eventRepo as any,
    {} as any, {} as any, {} as any, {} as any, {} as any,
    { get: () => undefined } as any, {} as any, {} as any, cache as any, {} as any);
  const dispute: any = { id: 'du_1', payment_intent: 'pi_1', status: 'needs_response', amount: 7662,
    currency: 'usd', charge: { id: 'ch_1', amount: 7662, currency: 'usd', payment_intent: 'pi_1' },
    evidence_details: { due_by: 1793663940 } };
  const stripe = { disputes: { retrieve: jest.fn(async () => dispute), list: jest.fn() },
    charges: { retrieve: jest.fn(async () => dispute.charge) } };
  (service as any).stripe = stripe;
  const notify = (type = 'charge.dispute.created', reference: any = dispute) =>
    service.handleStripeWebhook({ type, data: { object: reference } });
  return { service, order, eventRepo, orderRepo, transactionalOrders, stripe, dispute, cache, notify };
}

describe('Stripe disputes and organizer balances', () => {
  it.each(['needs_response', 'under_review', 'lost', 'warning_needs_response', 'warning_under_review'])(
    'withholds the $70 ticket share of a $76.62 %s dispute without changing the sale', async status => {
      const { order, dispute, notify, transactionalOrders, cache, eventRepo } = setup();
      dispute.status = status;
      await notify();
      expect(order.organizerDisputeAdjustment).toBe(70);
      expect(order).toMatchObject({ status: OrderStatus.PAID, subtotal: 70, total: 76.62 });
      expect(transactionalOrders.update).toHaveBeenCalledTimes(1);
      expect(eventRepo.findOne).toHaveBeenCalledWith(expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
      expect(cache.del).toHaveBeenCalledWith('organizer:stats:organizer');
      expect(cache.del).toHaveBeenCalledWith('admin:stats');
      expect(cache.del).toHaveBeenCalledWith('admin:financials');
    },
  );

  it.each(['charge.dispute.created', 'charge.dispute.updated', 'charge.dispute.closed',
    'charge.dispute.funds_withdrawn', 'charge.dispute.funds_reinstated'])(
    'handles %s using the current Stripe state', async type => {
      const { dispute, order, notify, stripe } = setup();
      dispute.status = 'won';
      order.organizerDisputeAdjustment = 70;
      await notify(type, { id: 'du_1', payment_intent: 'pi_1', status: 'lost' });
      expect(order.organizerDisputeAdjustment).toBe(0);
      expect(order.stripeDisputes.du_1.status).toBe('won');
      expect(stripe.disputes.retrieve).toHaveBeenCalledWith('du_1', { expand: ['charge'] });
    },
  );

  it('deduplicates notifications and aggregates partial disputes without withholding more than the ticket price', async () => {
    const { dispute, order, notify } = setup();
    dispute.amount = 3831;
    await notify();
    await notify();
    expect(order.organizerDisputeAdjustment).toBe(35);
    dispute.id = 'du_2';
    await notify();
    expect(order.organizerDisputeAdjustment).toBe(70);
    dispute.id = 'du_3';
    await notify();
    expect(order.organizerDisputeAdjustment).toBe(70);
    dispute.id = 'du_1'; dispute.status = 'won';
    await notify('charge.dispute.closed');
    expect(order.organizerDisputeAdjustment).toBe(70); // Two other partial disputes remain.
    dispute.id = 'du_2';
    await notify('charge.dispute.closed');
    expect(order.organizerDisputeAdjustment).toBe(35);
  });

  it('releases a closed inquiry without a chargeback', async () => {
    const { dispute, order, notify } = setup();
    await notify();
    dispute.status = 'warning_closed';
    await notify('charge.dispute.closed');
    expect(order.organizerDisputeAdjustment).toBe(0);
  });

  it.each(['currency', 'payment', 'amount', 'fractional'])('rejects a mismatched %s before changing a balance', async mismatch => {
    const { dispute, notify, transactionalOrders } = setup();
    if (mismatch === 'currency') dispute.currency = 'eur';
    if (mismatch === 'payment') dispute.charge.payment_intent = 'pi_other';
    if (mismatch === 'amount') dispute.amount = 99999;
    if (mismatch === 'fractional') dispute.amount = 12.3;
    await expect(notify()).rejects.toThrow('no coincide');
    expect(transactionalOrders.update).not.toHaveBeenCalled();
  });

  it('does not clear a reserve when Stripe cannot be reached', async () => {
    const { stripe, order, notify, transactionalOrders } = setup();
    order.organizerDisputeAdjustment = 70;
    stripe.disputes.retrieve.mockRejectedValue(new Error('Stripe unavailable'));
    await expect(notify()).rejects.toThrow('Stripe unavailable');
    expect(order.organizerDisputeAdjustment).toBe(70);
    expect(transactionalOrders.update).not.toHaveBeenCalled();
  });

  it('ignores unmatched payments rather than attributing them by buyer or amount', async () => {
    const { orderRepo, notify, transactionalOrders } = setup();
    orderRepo.findOne.mockResolvedValue(null as any);
    await notify();
    expect(transactionalOrders.update).not.toHaveBeenCalled();
  });

  it('resolves older payloads through their charge and uses the same payment link', async () => {
    const { notify, stripe, order } = setup();
    await notify('charge.dispute.created', { id: 'du_1', charge: 'ch_1' });
    expect(stripe.charges.retrieve).toHaveBeenCalledWith('ch_1');
    expect(order.organizerDisputeAdjustment).toBe(70);
  });

  it('synchronizes historical disputes across pages and limits changes to the requested event', async () => {
    const { service, dispute, stripe, order } = setup();
    stripe.disputes.list.mockResolvedValueOnce({ data: [dispute], has_more: true })
      .mockResolvedValueOnce({ data: [{ ...dispute, id: 'du_2' }], has_more: false });
    await expect(service.reconcileStripeDisputes(eventId)).resolves.toEqual({ updated: 2 });
    expect(stripe.disputes.list).toHaveBeenLastCalledWith({ limit: 100, starting_after: 'du_1' });
    expect(order.organizerDisputeAdjustment).toBe(70);
    order.eventId = 'different-event';
    stripe.disputes.list.mockResolvedValue({ data: [dispute], has_more: false });
    const calls = stripe.disputes.retrieve.mock.calls.length;
    await expect(service.reconcileStripeDisputes(eventId)).resolves.toEqual({ updated: 0 });
    expect(stripe.disputes.retrieve).toHaveBeenCalledTimes(calls);
  });

  it('handles free orders and proportional cent rounding', () => {
    const disputes = { du_1: { id: 'du_1', status: 'lost', amount: 76.62, currency: 'usd', evidenceDueBy: null } };
    expect(organizerDisputeAdjustment({ subtotal: 0, total: 0 }, disputes)).toBe(0);
    expect(organizerDisputeAdjustment({ subtotal: 0.25, total: 0.59 }, {
      du_1: { ...disputes.du_1, amount: 0.30 },
    })).toBe(0.13);
  });
});

describe('Dispute delivery and payout safeguards', () => {
  it('returns 503 to Stripe when a dispute cannot be persisted, so delivery is retried', async () => {
    const service = { handleStripeWebhook: jest.fn().mockRejectedValue(new Error('DB unavailable')) };
    const controller = new OrdersController(service as any, { get: () => undefined } as any, {} as any);
    (controller as any).stripe = { webhooks: { constructEvent: () => ({ type: 'charge.dispute.created' }) } };
    const response = { status: jest.fn().mockReturnThis(), send: jest.fn() };
    await controller.handleWebhook({ rawBody: Buffer.from('{}') }, 'signed', response);
    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.send).toHaveBeenCalledWith(expect.objectContaining({ received: false }));
  });

  it('refreshes Stripe before recording a payout, and fails closed on an outage', async () => {
    const admin = { recordOrganizerPayout: jest.fn() };
    const orders = { reconcileStripeDisputes: jest.fn().mockRejectedValue(new Error('Stripe unavailable')) };
    const controller = new AdminController(admin as any, {} as any, orders as any, {} as any);
    await expect(controller.recordOrganizerPayout(eventId, { amount: 280 } as any, { user: { id: 'admin' } }))
      .rejects.toThrow('Stripe unavailable');
    expect(admin.recordOrganizerPayout).not.toHaveBeenCalled();
    orders.reconcileStripeDisputes.mockResolvedValue({ updated: 1 });
    await controller.recordOrganizerPayout(eventId, { amount: 210 } as any, { user: { id: 'admin' } });
    expect(admin.recordOrganizerPayout).toHaveBeenCalledWith(eventId, { amount: 210 }, 'admin');
  });
});

function query(one: any = {}, many: any[] = []) {
  const q: any = {};
  for (const method of ['select', 'addSelect', 'where', 'andWhere', 'leftJoin', 'innerJoin',
    'orderBy', 'addOrderBy', 'groupBy', 'limit']) q[method] = jest.fn(() => q);
  q.getRawOne = jest.fn().mockResolvedValue(one);
  q.getRawMany = jest.fn().mockResolvedValue(many);
  q.getCount = jest.fn().mockResolvedValue(0);
  return q;
}

describe('Consistent dispute deductions in financial reports', () => {
  it.each([
    { title: 'Viva Maracaibo', subtotal: 16870, total: 18391.62, klarna: 144.68, disputed: 70,
      paid: 16445.32, pending: 210, recoverable: 0 },
    { title: 'Orlando', subtotal: 11080, total: 12351.84, klarna: 31.64, disputed: 200,
      paid: 11048.36, pending: 0, recoverable: 200 },
  ])('shows the $title dispute adjustment while preserving original sales and payouts', async fixture => {
    const eventRepo = { findOne: jest.fn().mockResolvedValue({ id: eventId, title: fixture.title }) };
    const orderRepo = { find: jest.fn().mockResolvedValue([{ id: 'order-1', subtotal: fixture.subtotal,
      total: fixture.total, ticketCount: 1, organizerProcessingAdjustment: fixture.klarna,
      organizerDisputeAdjustment: fixture.disputed, stripeDisputes: { du_1: { id: 'du_1', status: 'lost' } },
    }]) };
    const service = new AdminService({} as any, eventRepo as any, orderRepo as any,
      { find: jest.fn().mockResolvedValue([]) } as any, {} as any,
      { createQueryBuilder: () => query() } as any,
      { find: jest.fn().mockResolvedValue([{ amount: fixture.paid }]) } as any,
      {} as any, {} as any);
    const report = await service.getEventFinancialDetail(eventId);
    expect(report.summary).toMatchObject({ grossCharged: fixture.total, ticketRevenue: fixture.subtotal,
      organizerPaid: fixture.paid, organizerDisputeAdjustments: fixture.disputed,
      organizerPending: fixture.pending, organizerRecoverable: fixture.recoverable });
    expect(report.orders[0]).toMatchObject({ total: fixture.total,
      organizerDisputeAdjustment: fixture.disputed, stripeDisputes: [{ id: 'du_1', status: 'lost' }] });
  });

  it('deducts disputes in the global admin and per-event summaries', async () => {
    const sums = { totalRevenue: 18391.62, totalCharged: 18391.62, ticketSales: 16870,
      organizerProcessingAdjustments: 144.68, organizerDisputeAdjustments: 70 };
    const payouts = query({ organizerPaid: 16445.32 }, [{ eventId, organizerPaid: 16445.32 }]);
    const service = new AdminService({ count: jest.fn().mockResolvedValue(0) } as any,
      { count: jest.fn().mockResolvedValue(1), find: jest.fn().mockResolvedValue([{ id: eventId }]) } as any,
      { count: jest.fn().mockResolvedValue(83), createQueryBuilder: alias => query(sums,
        alias === 'o' ? [{ ...sums, eventId, orders: 83 }] : []) } as any,
      { count: jest.fn().mockResolvedValue(0) } as any, {} as any, {} as any,
      { createQueryBuilder: () => payouts } as any,
      { get: jest.fn(), set: jest.fn() } as any, {} as any);
    expect(await service.getDashboardStats()).toMatchObject({ organizerDisputeAdjustments: 70, organizerPending: 210 });
    expect((await service.getEventsFinancials()).events[0]).toMatchObject({ organizerDisputeAdjustments: 70, organizerPending: 210 });
  });

  it('uses the same available balance in the organizer dashboard', async () => {
    const { service, orderRepo } = setup();
    (orderRepo as any).createQueryBuilder = jest.fn().mockReturnValueOnce(query({ totalRevenue: 16870,
      totalCharged: 18391.62, organizerProcessingAdjustments: 144.68, organizerDisputeAdjustments: 70 }))
      .mockReturnValueOnce(query());
    (service as any).ticketRepo = { createQueryBuilder: () => query() };
    (service as any).organizerPayoutRepo = { createQueryBuilder: () => query({ organizerPaid: 16445.32 }) };
    expect(await service.getOrganizerStats('organizer')).toMatchObject({
      organizerPending: 210, organizerDisputeAdjustments: 70, organizerRecoverable: 0,
    });
  });

  it.each([280, 210])('validates a requested $%s payout against the $210 after-dispute balance', async amount => {
    const payoutRepo = { createQueryBuilder: () => query({ totalPaid: 16445.32 }),
      create: jest.fn(value => value), save: jest.fn(async value => value) };
    let orderQuery = 0;
    const orderRepo = { createQueryBuilder: () => ++orderQuery % 2
      ? query({ ticketRevenue: 16870 })
      : query({ organizerAdjustments: 144.68, disputeAdjustments: 70, pendingReconciliations: 0 }) };
    const manager = { getRepository: entity => entity === Event
      ? { findOne: jest.fn().mockResolvedValue({ id: eventId, organizerId: 'organizer' }) }
      : entity === Order ? orderRepo : payoutRepo };
    const service = new AdminService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any,
      { manager: { transaction: async run => run(manager) } } as any,
      { del: jest.fn() } as any, {} as any);
    const result = service.recordOrganizerPayout(eventId, { amount } as any, 'admin');
    if (amount === 280) {
      await expect(result).rejects.toThrow('mayor al saldo');
      expect(payoutRepo.save).not.toHaveBeenCalled();
    } else {
      await expect(result).resolves.toMatchObject({ amount: 210, organizerUserId: 'organizer' });
    }
  });
});
