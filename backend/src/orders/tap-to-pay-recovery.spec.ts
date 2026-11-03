import { Event, Order, UserRole } from '../database/entities';
import { OrdersService } from './orders.service';

const requestId = '33333333-3333-4333-8333-333333333333';
const actor = { id: 'operator', role: UserRole.ADMIN };

function setup() {
  const event = { id: 'event-1', title: 'Original event', currency: 'USD', maxTicketsPerTransaction: 10 };
  const state = { orders: [] as any[], intents: new Map<string, any>() };
  const orders: any = {
    create: jest.fn(data => data),
    save: jest.fn(async data => {
      const order = { ...data, id: `order-${state.orders.length + 1}` };
      state.orders.push(order);
      return order;
    }),
    update: jest.fn(async (id, values) => Object.assign(state.orders.find(order => order.id === id), values)),
    createQueryBuilder: jest.fn(() => {
      const params: any = {};
      const query: any = {
        where: jest.fn((_sql, values) => { Object.assign(params, values); return query; }),
        andWhere: jest.fn((_sql, values) => { Object.assign(params, values); return query; }),
        getOne: jest.fn(async () => state.orders.find(order => order.eventId === params.eventId
          && order.userId === params.userId && order.salesChannel === params.channel
          && order.seatsData.includes(params.requestId.slice(1, -1)))),
      };
      return query;
    }),
  };
  const eventQuery: any = {
    setLock: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(),
    getOne: jest.fn(async () => event),
  };
  let queue: Promise<any> = Promise.resolve();
  orders.manager = { transaction: jest.fn(callback => {
    const next = queue.then(() => callback({ getRepository: (entity: any) => entity === Event
      ? { createQueryBuilder: () => eventQuery } : entity === Order ? orders : undefined }));
    queue = next.catch(() => undefined);
    return next;
  }) };
  const stripe = { paymentIntents: {
    create: jest.fn(async (params, options) => {
      const key = options.idempotencyKey;
      const previous = state.intents.get(key);
      if (previous) {
        expect(params).toEqual(previous.params);
        return previous.intent;
      }
      const intent = { id: `pi_${state.intents.size + 1}`, client_secret: 'test-only', ...params };
      state.intents.set(key, { params, intent });
      return intent;
    }),
    retrieve: jest.fn(async id => [...state.intents.values()].find(value => value.intent.id === id).intent),
  } };
  const service = new OrdersService(orders, {} as any, {} as any,
    { findOne: jest.fn(async () => event) } as any, {} as any, {} as any, {} as any, {} as any, {} as any,
    { get: jest.fn(() => undefined) } as any, {} as any, {} as any,
    { del: jest.fn() } as any, {} as any);
  (service as any).stripe = stripe;
  const create = (amount = 20, quantity = 1, id: string | undefined = requestId) =>
    service.createDoorSaleTapToPayIntent(actor, event.id, amount, quantity, undefined, undefined, id);
  return { service, create, state, stripe, orders, event, eventQuery };
}

describe('Tap to Pay recovery across lost network responses', () => {
  it('returns the exact same payment after a successful response is lost', async () => {
    const f = setup();
    const first = await f.create();
    const retry = await f.create();
    expect(retry).toEqual(first);
    expect(f.state.orders).toHaveLength(1);
    expect(f.state.intents.size).toBe(1);
    expect(f.stripe.paymentIntents.create).toHaveBeenCalledTimes(1);
    expect(f.stripe.paymentIntents.retrieve).toHaveBeenCalledWith(first.paymentIntentId);
  });

  it('reuses Stripe idempotency when the provider creates an intent but its response times out', async () => {
    const f = setup();
    const create = f.stripe.paymentIntents.create.getMockImplementation()!;
    f.stripe.paymentIntents.create.mockImplementationOnce(async (params, options) => {
      await create(params, options);
      throw new Error('Stripe response timeout');
    });
    await expect(f.create()).rejects.toThrow('timeout');
    const retry = await f.create();
    expect(retry.paymentIntentId).toBe('pi_1');
    expect(f.state.orders).toHaveLength(1);
    expect(f.state.intents.size).toBe(1);
    expect(f.stripe.paymentIntents.create.mock.calls.map(call => call[1].idempotencyKey))
      .toEqual(['door-intent-order-1', 'door-intent-order-1']);
  });

  it('recovers the same intent if saving its ID failed, preserving the original currency and description', async () => {
    const f = setup();
    f.orders.update.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(f.create()).rejects.toThrow('database unavailable');
    f.event.currency = 'CAD'; f.event.title = 'Changed title';
    const retry = await f.create();
    expect(retry.paymentIntentId).toBe('pi_1');
    expect(retry.event.currency).toBe('USD');
    expect(f.state.intents.size).toBe(1);
    expect(f.state.orders).toHaveLength(1);
  });

  it('serializes simultaneous retries into one order and one Stripe payment', async () => {
    const f = setup();
    const results = await Promise.all([f.create(), f.create()]);
    expect(results[0].orderId).toBe(results[1].orderId);
    expect(results[0].paymentIntentId).toBe(results[1].paymentIntentId);
    expect(f.state.orders).toHaveLength(1);
    expect(f.state.intents.size).toBe(1);
    expect(f.eventQuery.setLock).toHaveBeenCalledWith('pessimistic_write');
  });

  it.each([[21, 1], [20, 2]])('rejects a different selection using the same request (%s, %s)', async (amount, quantity) => {
    const f = setup(); await f.create();
    await expect(f.create(amount, quantity)).rejects.toThrow('otro monto o cantidad');
    expect(f.state.intents.size).toBe(1);
  });

  it('rejects an invalid request ID before creating orders or contacting Stripe', async () => {
    const f = setup();
    await expect(f.create(20, 1, 'invalid')).rejects.toThrow('solicitud');
    expect(f.state.orders).toHaveLength(0);
    expect(f.stripe.paymentIntents.create).not.toHaveBeenCalled();
  });

  it('isolates request IDs by authenticated operator', async () => {
    const f = setup();
    await f.create();
    await f.service.createDoorSaleTapToPayIntent({ ...actor, id: 'other-operator' }, f.event.id, 20, 1, undefined, undefined, requestId);
    expect(f.state.orders).toHaveLength(2);
    expect(f.state.intents.size).toBe(2);
  });

  it('continues to accept legacy apps without request IDs', async () => {
    const f = setup();
    const result = await f.service.createDoorSaleTapToPayIntent(actor, f.event.id, 20);
    expect(result.paymentIntentId).toBe('pi_1');
    expect(f.orders.manager.transaction).not.toHaveBeenCalled();
  });
});
