import { AdminService } from '../admin/admin.service';
import { AdminController } from '../admin/admin.controller';
import { Event, Order, OrderStatus } from '../database/entities';
import { payoutOrderFingerprint } from '../common/utils/organizer-payout-verification';
import { OrdersService } from './orders.service';

const eventId = 'efcd3cb0-3db0-4f12-9724-ad3b4bc168c2';
function setup() {
  const order: any = { id: 'order-1', eventId, status: OrderStatus.PAID, subtotal: 70, total: 76.62,
    stripePaymentIntent: 'pi_1', organizerDisputeAdjustment: 0, organizerProcessingAdjustment: 0 };
  const event: any = { id: eventId, currency: 'USD', organizerId: 'organizer' };
  const charge: any = { id: 'ch_1', payment_intent: 'pi_1', amount: 7662, amount_captured: 7662,
    amount_refunded: 0, currency: 'usd', paid: true, captured: true, status: 'succeeded', disputed: false };
  const intent: any = { id: 'pi_1', amount: 7662, amount_received: 7662, currency: 'usd',
    status: 'succeeded', latest_charge: charge, metadata: { orderId: order.id, eventId } };
  const orders: any = { find: jest.fn().mockResolvedValue([order]), update: jest.fn() };
  const eventRepo: any = { findOne: jest.fn().mockResolvedValue(event) };
  const service = new OrdersService(orders, {} as any, {} as any, eventRepo, {} as any, {} as any,
    {} as any, {} as any, {} as any, { get: () => undefined } as any, {} as any, {} as any, {} as any, {} as any);
  const sync = jest.spyOn(service, 'reconcileStripeDisputes').mockResolvedValue({ updated: 0 });
  const stripe = { paymentIntents: { retrieve: jest.fn().mockResolvedValue(intent) },
    charges: { retrieve: jest.fn().mockResolvedValue(charge) },
    checkout: { sessions: { retrieve: jest.fn().mockResolvedValue({ mode: 'payment', amount_total: 7662,
      currency: 'usd', payment_intent: 'pi_1' }) } },
    disputes: { list: jest.fn().mockResolvedValue({ data: [], has_more: false }) } };
  (service as any).stripe = stripe;
  const verify = () => service.verifyOrganizerPayout(eventId);
  return { service, verify, order, event, charge, intent, orders, eventRepo, stripe, sync };
}

describe('Stripe verification outside checkout and ticket issuance', () => {
  it('checks a captured successful payment without changing the order or issuing tickets', async () => {
    const { verify, order, orders, stripe, sync } = setup();
    expect(await verify()).toMatchObject({ eventId, currency: 'usd', orders: [
      { id: order.id, fingerprint: payoutOrderFingerprint(order), excludedTicketAmount: 0 },
    ] });
    expect(sync).not.toHaveBeenCalled();
    expect(stripe.paymentIntents.retrieve).toHaveBeenCalledWith('pi_1', { expand: ['latest_charge'] },
      { timeout: 10000, maxNetworkRetries: 0 });
    expect(orders.update).not.toHaveBeenCalled();
  });

  it.each(['canceled', 'requires_payment_method'])('excludes an unpaid %s intent', async status => {
    const { verify, intent } = setup();
    intent.status = status; intent.amount_received = 0;
    expect((await verify()).orders[0].excludedTicketAmount).toBe(70);
  });

  it.each(['processing', 'requires_capture', 'requires_action', 'requires_confirmation'])(
    'blocks rather than authorizing an uncertain %s payment', async status => {
      const { verify, intent } = setup(); intent.status = status;
      await expect(verify()).rejects.toThrow('Por verificar');
    });

  it.each([[7662, 70], [3831, 35]])('deducts a %s-cent refund from the ticket-price share only', async (refund, held) => {
    const { verify, charge } = setup(); charge.amount_refunded = refund;
    expect((await verify()).orders[0].excludedTicketAmount).toBe(held);
  });

  it('caps paginated refunds plus disputes at the ticket share without double-counting the stored reserve', async () => {
    const { verify, charge, order, stripe } = setup();
    charge.disputed = true; charge.amount_refunded = 3831; order.organizerDisputeAdjustment = 35;
    const dispute = { id: 'du_1', charge: 'ch_1', currency: 'usd', amount: 3831, status: 'lost' };
    stripe.disputes.list.mockResolvedValueOnce({ data: [], has_more: false })
      .mockResolvedValueOnce({ data: [dispute], has_more: true })
      .mockResolvedValueOnce({ data: [{ ...dispute, id: 'du_2', status: 'under_review' }], has_more: false });
    expect((await verify()).orders[0].excludedTicketAmount).toBe(70);
    expect(stripe.disputes.list).toHaveBeenLastCalledWith({ charge: 'ch_1', limit: 100, starting_after: 'du_1' },
      { timeout: 10000, maxNetworkRetries: 0 });
  });

  it('does not withhold a won dispute', async () => {
    const { verify, charge, stripe } = setup(); charge.disputed = true;
    stripe.disputes.list.mockResolvedValue({ data: [
      { id: 'du_1', charge: 'ch_1', currency: 'usd', amount: 7662, status: 'won' },
    ], has_more: false });
    expect((await verify()).orders[0].excludedTicketAmount).toBe(0);
  });

  it('checks inquiries from the dispute index even when Charge.disputed is false', async () => {
    const { verify, stripe } = setup();
    stripe.disputes.list.mockResolvedValue({ data: [
      { id: 'du_1', charge: 'ch_1', currency: 'usd', amount: 7662, status: 'warning_needs_response' },
    ], has_more: false });
    expect((await verify()).orders[0].excludedTicketAmount).toBe(70);
  });

  it.each(['currency', 'amount', 'received', 'metadata', 'charge', 'captured', 'paid', 'refund'])(
    'blocks a %s mismatch or malformed Stripe amount', async mismatch => {
      const { verify, charge, intent } = setup();
      if (mismatch === 'currency') intent.currency = 'eur';
      if (mismatch === 'amount') intent.amount = 123;
      if (mismatch === 'received') intent.amount_received = 100;
      if (mismatch === 'metadata') intent.metadata.orderId = 'other';
      if (mismatch === 'charge') charge.payment_intent = 'pi_other';
      if (mismatch === 'captured') charge.amount_captured = 100;
      if (mismatch === 'paid') charge.paid = false;
      if (mismatch === 'refund') charge.amount_refunded = 99999;
      await expect(verify()).rejects.toThrow('Por verificar');
    });

  it('fails closed on a Stripe outage or an unresolved disputed charge', async () => {
    const { verify, stripe, charge } = setup();
    stripe.paymentIntents.retrieve.mockRejectedValueOnce(new Error('Unavailable'));
    await expect(verify()).rejects.toThrow('Por verificar');
    charge.disputed = true;
    await expect(verify()).rejects.toThrow('Por verificar');
  });

  it('resolves a legacy Checkout reference and does not count one payment twice', async () => {
    const { verify, order, orders, stripe } = setup();
    order.stripePaymentIntent = null; order.stripeSessionId = 'cs_1';
    expect((await verify()).orders[0].excludedTicketAmount).toBe(0);
    expect(stripe.checkout.sessions.retrieve).toHaveBeenCalledWith('cs_1', {}, expect.any(Object));
    orders.find.mockResolvedValue([order, { ...order, id: 'order-2' }]);
    await expect(verify()).rejects.toThrow('Por verificar');
  });

  it('does not accept a nonzero sale without a Stripe reference, while free orders need no charge', async () => {
    const { verify, order, stripe } = setup(); order.stripePaymentIntent = null;
    await expect(verify()).rejects.toThrow('Por verificar');
    order.total = 0; order.subtotal = 0;
    expect((await verify()).orders[0].excludedTicketAmount).toBe(0);
    expect(stripe.paymentIntents.retrieve).not.toHaveBeenCalled();
  });

  it('limits concurrency to four Stripe reads and never holds a database transaction during them', async () => {
    const { verify, orders, stripe, order, intent, charge } = setup();
    orders.find.mockResolvedValue(Array.from({ length: 9 }, (_, i) => ({ ...order, id: 'o_' + i, stripePaymentIntent: 'pi_' + i })));
    let active = 0, peak = 0;
    stripe.paymentIntents.retrieve.mockImplementation(async id => {
      active++; peak = Math.max(peak, active);
      await new Promise(resolve => setTimeout(resolve, 1));
      active--;
      return { ...intent, id, metadata: {}, latest_charge: { ...charge, payment_intent: id } };
    });
    expect((await verify()).orders).toHaveLength(9);
    expect(peak).toBe(4);
    expect(orders.manager).toBeUndefined();
  });
});

function adminSetup() {
  const { order, event } = setup();
  const quote = { eventId, currency: 'usd', verifiedAt: Date.now(), orders: [
    { id: order.id, fingerprint: payoutOrderFingerprint(order), excludedTicketAmount: 35 },
  ] };
  const paidQuery: any = { select: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ totalPaid: 0 }) };
  const payouts = { createQueryBuilder: () => paidQuery, create: jest.fn(x => x), save: jest.fn(async x => x) };
  const orders = { find: jest.fn().mockResolvedValue([order]) };
  const events = { findOne: jest.fn().mockResolvedValue(event) };
  const manager: any = { getRepository: entity => entity === Event ? events : entity === Order ? orders : payouts };
  const service = new AdminService({} as any, events as any, { manager } as any, {} as any, {} as any, {} as any,
    { manager: { transaction: jest.fn(async run => run(manager)) } } as any,
    { del: jest.fn() } as any, {} as any);
  return { service, order, event, quote, orders, paidQuery, payouts };
}

describe('Verified payout amount and concurrent changes', () => {
  it('shows the verified balance before confirmation without recording a payout', async () => {
    const { service, quote, payouts } = adminSetup();
    expect(await service.getVerifiedOrganizerPayout(eventId, quote)).toMatchObject({
      organizerPending: 35, excludedTicketAmount: 35, organizerRecoverable: 0,
    });
    expect(payouts.save).not.toHaveBeenCalled();
  });

  it('allows the verified amount and rejects the amount shown before a refund', async () => {
    const { service, quote, payouts } = adminSetup();
    await expect(service.recordOrganizerPayout(eventId, { amount: 70 }, 'admin', quote)).rejects.toThrow('mayor al saldo');
    expect(payouts.save).not.toHaveBeenCalled();
    await expect(service.recordOrganizerPayout(eventId, { amount: 35 }, 'admin', quote)).resolves.toMatchObject({ amount: 35 });
  });

  it.each(['missing', 'expired', 'event', 'currency', 'added-order', 'changed-total', 'new-dispute', 'missing-row', 'duplicate'])(
    'rejects %s verification without saving a payout', async scenario => {
      const { service, quote, order, orders, payouts } = adminSetup();
      if (scenario === 'expired') quote.verifiedAt -= 6 * 60000;
      if (scenario === 'event') quote.eventId = 'other';
      if (scenario === 'currency') quote.currency = 'eur';
      if (scenario === 'added-order') orders.find.mockResolvedValue([order, { ...order, id: 'new' }]);
      if (scenario === 'changed-total') order.total = 100;
      if (scenario === 'new-dispute') order.organizerDisputeAdjustment = 70;
      if (scenario === 'missing-row') orders.find.mockResolvedValue([]);
      if (scenario === 'duplicate') quote.orders.push(quote.orders[0]);
      await expect(service.recordOrganizerPayout(eventId, { amount: 35 }, 'admin',
        scenario === 'missing' ? undefined as any : quote)).rejects.toThrow('Por verificar');
      expect(payouts.save).not.toHaveBeenCalled();
    });

  it('rechecks previously recorded payouts inside the transaction', async () => {
    const { service, quote, paidQuery } = adminSetup(); paidQuery.getRawOne.mockResolvedValue({ totalPaid: 30 });
    await expect(service.recordOrganizerPayout(eventId, { amount: 35 }, 'admin', quote)).rejects.toThrow('mayor al saldo');
    await expect(service.recordOrganizerPayout(eventId, { amount: 5 }, 'admin', quote)).resolves.toMatchObject({ amount: 5 });
  });

  it('exposes only the calculated balance in the administrative preview', async () => {
    const verification: any = { eventId };
    const orders = { verifyOrganizerPayout: jest.fn().mockResolvedValue(verification) };
    const admin = { getVerifiedOrganizerPayout: jest.fn().mockResolvedValue({ organizerPending: 35 }) };
    const controller = new AdminController(admin as any, {} as any, orders as any, {} as any);
    expect(await controller.verifyOrganizerPayout(eventId)).toEqual({ organizerPending: 35 });
    expect(admin.getVerifiedOrganizerPayout).toHaveBeenCalledWith(eventId, verification);
  });
});
