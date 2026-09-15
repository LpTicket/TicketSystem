// Runs the actual service through TypeScript with an isolated native/HTTP boundary.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const ts = require('typescript');
const compiled = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../src/services/tapToPay.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;
function setup() {
  const storage = new Map();
  let created = 0, processed = 0, connects = 0, initialized = 0;
  let status = { success: true, orderId: 'order1', paymentStatus: 'succeeded', ticketCount: 1 };
  let sdkError = false, networkError = false, connection = 'notConnected';
  const verified = [];
  const terminal = {
    initialize: async () => { initialized++; return {}; },
    easyConnect: async () => { connects++; connection = 'connected'; return {}; },
    getConnectionStatus: async () => connection,
    retrievePaymentIntent: async () => ({ paymentIntent: { id: 'pi_test' } }),
    processPaymentIntent: async () => { processed++; if (sdkError) throw new Error('timeout'); return { paymentIntent: { id: 'pi_test' } }; },
    setConnectionToken: async () => {}, disconnectReader: async () => {},
  };
  const api = {
    getDoorSaleTapToPayConfig: async () => ({ locationId: 'loc_test' }),
    createDoorSaleTapToPayIntent: async () => { created++; return { orderId: 'order1', paymentIntentId: 'pi_test', clientSecret: 'secret-never-store', invoice: { quantity: 1 } }; },
    verifyDoorSaleTapToPay: async (payload) => { verified.push(payload); if (networkError) throw new Error('offline'); return status; },
  };
  const mockRequire = (name) => {
    if (name === 'react-native') return { Platform: { OS: 'ios' }, NativeModules: { StripeTerminalReactNative: { getConstants: () => ({ FETCH_TOKEN_PROVIDER: 'token' }) } }, NativeEventEmitter: class { addListener() { return { remove() {} }; } } };
    if (name.includes('async-storage')) return { getItem: async (k) => storage.get(k) || null, setItem: async (k, v) => storage.set(k, v), removeItem: async (k) => storage.delete(k) };
    if (name === './doorSales') return api;
    if (name.includes('stripe-terminal')) return terminal;
    throw new Error(name);
  };
  function load() {
    const exports = {};
    vm.runInNewContext(compiled, { exports, require: mockRequire, console });
    return exports;
  }
  return { service: load(), reload: load, storage, verified, setStatus: (v) => status = v,
    failSDK: () => sdkError = true, setOffline: (v) => networkError = v, disconnect: () => connection = 'notConnected',
    counts: () => ({ created, processed, connects, initialized }) };
}
const params = { userId: 'operator', eventId: 'event1', quantity: 1, amount: 20, canAcceptTerms: true };
test('only server succeeded plus all tickets triggers complete', async () => {
  const env = setup(); const phases = [];
  const result = await env.service.runDoorSaleTapToPay({ ...params, onPhase: (p) => phases.push(p) });
  assert.equal(result.success, true); assert.equal(phases.at(-1), 'complete'); assert.equal(env.storage.size, 0);
});
test('SDK apparent success with incomplete Stripe payment never approves or clears pending', async () => {
  const env = setup(); const phases = [];
  env.setStatus({ success: false, orderId: 'order1', paymentStatus: 'requires_payment_method', retryAllowed: true });
  const result = await env.service.runDoorSaleTapToPay({ ...params, onPhase: (p) => phases.push(p) });
  assert.equal(result.success, false); assert.equal(phases.includes('complete'), false);
  assert.equal(env.storage.size, 1); assert.equal([...env.storage.values()].join().includes('secret-never-store'), false);
});
test('native timeout is reconciled against the same intent without charging twice', async () => {
  const env = setup(); env.failSDK();
  assert.equal((await env.service.runDoorSaleTapToPay(params)).success, true);
  assert.equal(env.verified[0].paymentIntentId, 'pi_test'); assert.equal(env.counts().processed, 1);
});
test('network uncertainty survives restart, verifies only, and is isolated by operator', async () => {
  const env = setup(); env.setOffline(true);
  await assert.rejects(env.service.runDoorSaleTapToPay(params));
  const service = env.reload();
  assert.equal(await service.getPendingTapPayment('another-operator'), null);
  assert.equal((await service.getPendingTapPayment('operator')).paymentIntentId, 'pi_test');
  env.setOffline(false);
  assert.equal((await service.runDoorSaleTapToPay(params)).success, true);
  assert.equal(env.counts().created, 1); assert.equal(env.counts().processed, 1);
});
test('explicit retry reuses the same payment, with no new intent', async () => {
  const env = setup();
  env.setStatus({ success: false, orderId: 'order1', paymentStatus: 'requires_payment_method', retryAllowed: true, clientSecret: 'secret-never-store' });
  await env.service.runDoorSaleTapToPay(params);
  await env.service.runDoorSaleTapToPay({ ...params, retryPending: true });
  assert.equal(env.counts().created, 1); assert.equal(env.counts().processed, 2);
});
test('an invalid success contract is rejected and retains the pending payment', async () => {
  const env = setup(); env.setStatus({ success: true, orderId: 'order1', paymentStatus: 'processing', ticketCount: 1 });
  await assert.rejects(env.service.runDoorSaleTapToPay(params)); assert.equal(env.storage.size, 1);
});
test('double press cannot start a second sale', async () => {
  const env = setup(); const first = env.service.runDoorSaleTapToPay(params);
  await assert.rejects(env.service.runDoorSaleTapToPay(params), /cobro en curso/);
  await first; assert.equal(env.counts().created, 1);
});
test('a disconnected reader is prepared again instead of trusting cached connected=true', async () => {
  const env = setup(); await env.service.prepareDoorSaleTapToPay(params); env.disconnect();
  await env.service.prepareDoorSaleTapToPay(params); assert.equal(env.counts().connects, 2);
});
test('only confirmed cancellation clears the pending purchase', async () => {
  const env = setup(); env.setOffline(true); await assert.rejects(env.service.runDoorSaleTapToPay(params)); env.setOffline(false);
  env.setStatus({ success: false, orderId: 'order1', paymentStatus: 'processing' });
  await env.service.resolvePendingTapPayment('operator', 'cancel'); assert.equal(env.storage.size, 1);
  env.setStatus({ success: false, orderId: 'order1', paymentStatus: 'canceled', cancelled: true });
  await env.service.resolvePendingTapPayment('operator', 'cancel'); assert.equal(env.storage.size, 0);
});

test('background preparation and a charge share initialization and reader connection', async () => {
  const env = setup();
  await Promise.all([env.service.prepareDoorSaleTapToPay(params), env.service.runDoorSaleTapToPay(params)]);
  assert.equal(env.counts().initialized, 1);
  assert.equal(env.counts().connects, 1);
  assert.equal(env.counts().processed, 1);
});
