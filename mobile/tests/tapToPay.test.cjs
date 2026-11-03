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
  let sdkResult = {}, sdkThrown, retrieveError;
  let sdkError = false, networkError = false, lostCreateResponse = false, connection = 'notConnected';
  const creationRequests = [];
  const intents = new Map();
  let storageWrites = 0, failedStorageWrite;
  const verified = [];
  const terminal = {
    initialize: async () => { initialized++; return {}; },
    easyConnect: async () => { connects++; connection = 'connected'; return {}; },
    getConnectionStatus: async () => connection,
    retrievePaymentIntent: async () => retrieveError ? { error: retrieveError } : { paymentIntent: { id: 'pi_test' } },
    processPaymentIntent: async () => { processed++; if (sdkThrown) throw sdkThrown; if (sdkError) throw new Error('timeout'); return { paymentIntent: { id: 'pi_test' }, ...sdkResult }; },
    setConnectionToken: async () => {}, disconnectReader: async () => {},
  };
  const api = {
    getDoorSaleTapToPayConfig: async () => ({ locationId: 'loc_test' }),
    createDoorSaleTapToPayIntent: async (payload) => {
      creationRequests.push(payload);
      if (!intents.has(payload.requestId)) {
        created++;
        intents.set(payload.requestId, { orderId: 'order1', paymentIntentId: 'pi_test', clientSecret: 'secret-never-store', invoice: { quantity: 1 } });
      }
      if (lostCreateResponse) throw new Error('response lost');
      return intents.get(payload.requestId);
    },
    verifyDoorSaleTapToPay: async (payload) => { verified.push(payload); if (networkError) throw new Error('offline'); return status; },
  };
  const mockRequire = (name) => {
    if (name === 'react-native') return { Platform: { OS: 'ios' }, NativeModules: { StripeTerminalReactNative: { getConstants: () => ({ FETCH_TOKEN_PROVIDER: 'token' }) } }, NativeEventEmitter: class { addListener() { return { remove() {} }; } } };
    if (name.includes('async-storage')) return {
      getItem: async (k) => storage.get(k) || null,
      setItem: async (k, v) => { if (++storageWrites === failedStorageWrite) throw new Error('storage unavailable'); storage.set(k, v); },
      removeItem: async (k) => storage.delete(k),
    };
    if (name === './doorSales') return api;
    if (name === 'expo-crypto') return { randomUUID: () => require('node:crypto').randomUUID() };
    if (name.includes('stripe-terminal')) return terminal;
    throw new Error(name);
  };
  function load() {
    const exports = {};
    vm.runInNewContext(compiled, { exports, require: mockRequire, console });
    return exports;
  }
  return { service: load(), reload: load, storage, verified, setStatus: (v) => status = v,
    setSDKResult: (v) => sdkResult = v, throwSDK: (v) => sdkThrown = v,
    setRetrieveError: (v) => retrieveError = v,
    creationRequests, loseCreateResponse: (v) => lostCreateResponse = v,
    failStorageWrite: (number) => failedStorageWrite = number,
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

for (const throws of [false, true]) {
  test(`native cancellation (${throws ? 'thrown' : 'returned'}) resolves and allows the next sale with a warm reader`, async () => {
    const env = setup();
    if (throws) env.throwSDK({ code: 'CANCELED' });
    else env.setSDKResult({ error: { code: 'CANCELED' } });
    env.setStatus({ success: false, orderId: 'order1', paymentStatus: 'canceled', cancelled: true });
    await env.service.runDoorSaleTapToPay(params);
    assert.equal(env.verified[0].action, 'cancel');
    assert.equal(env.storage.size, 0);
    env.throwSDK(undefined); env.setSDKResult({});
    env.setStatus({ success: true, orderId: 'order1', paymentStatus: 'succeeded', ticketCount: 1 });
    assert.equal((await env.service.runDoorSaleTapToPay(params)).success, true);
    assert.equal(env.counts().created, 2);
    assert.equal(env.counts().connects, 1);
  });
}
test('cancellation racing with a successful charge reports success without another charge', async () => {
  const env = setup(); env.setSDKResult({ error: { code: 'CANCELED' } });
  assert.equal((await env.service.runDoorSaleTapToPay(params)).success, true);
  assert.equal(env.verified[0].action, 'cancel'); assert.equal(env.counts().processed, 1);
});
test('cancellation with offline confirmation keeps the purchase pending', async () => {
  const env = setup(); env.setSDKResult({ error: { code: 'CANCELED' } }); env.setOffline(true);
  await assert.rejects(env.service.runDoorSaleTapToPay(params));
  assert.equal(env.storage.size, 1);
  await assert.rejects(env.service.runDoorSaleTapToPay(params));
  assert.equal(env.counts().created, 1);
});
test('a non-cancellation SDK error only verifies the payment', async () => {
  const env = setup(); env.setSDKResult({ error: { code: 'CANCELED_DUE_TO_INTEGRATION_ERROR' } });
  await env.service.runDoorSaleTapToPay(params);
  assert.equal(env.verified[0].action, 'verify');
});

test('cancellation while retrieving the payment retains its native code and cancels the same purchase', async () => {
  const env = setup();
  env.setRetrieveError({ code: 'CANCELED', message: 'Cancelled' });
  env.setStatus({ success: false, orderId: 'order1', paymentStatus: 'canceled', cancelled: true });
  await env.service.runDoorSaleTapToPay(params);
  assert.equal(env.verified[0].action, 'cancel');
  assert.equal(env.counts().processed, 0);
  assert.equal(env.storage.size, 0);
});

for (const source of ['native', 'operator']) {
  test(`${source} cancellation survives offline confirmation and restart, then permits the next sale`, async () => {
    const env = setup();
    env.setOffline(true);
    if (source === 'native') env.setSDKResult({ error: { code: 'CANCELED' } });
    await assert.rejects(env.service.runDoorSaleTapToPay(params));
    if (source === 'operator') await assert.rejects(env.service.resolvePendingTapPayment('operator', 'cancel'));
    assert.equal((await env.service.getPendingTapPayment('operator')).cancellationRequested, true);

    const service = env.reload();
    env.setOffline(false);
    env.setStatus({ success: false, orderId: 'order1', paymentStatus: 'canceled', cancelled: true });
    const result = await service.resolvePendingTapPayment('operator');
    assert.equal(result.cancelled, true);
    assert.equal(env.verified.at(-1).action, 'cancel');
    assert.equal(env.counts().processed, 1);
    assert.equal(env.storage.size, 0);

    env.setSDKResult({});
    env.setStatus({ success: true, orderId: 'order1', paymentStatus: 'succeeded', ticketCount: 1 });
    assert.equal((await service.runDoorSaleTapToPay(params)).success, true);
    assert.equal(env.counts().created, 2);
  });
}

test('an unconfirmed cancellation cannot be retried as a charge, even after restart', async () => {
  const env = setup(); env.setSDKResult({ error: { code: 'CANCELED' } });
  env.setStatus({ success: false, orderId: 'order1', paymentStatus: 'requires_payment_method', retryAllowed: true, clientSecret: 'secret-never-store' });
  const result = await env.service.runDoorSaleTapToPay(params);
  assert.equal(result.retryAllowed, false);
  assert.equal(result.clientSecret, undefined);
  const service = env.reload();
  await service.runDoorSaleTapToPay({ ...params, retryPending: true });
  assert.equal(env.verified.at(-1).action, 'cancel');
  assert.equal(env.counts().created, 1);
  assert.equal(env.counts().processed, 1);
  assert.equal(env.storage.size, 1);
});

test('a saved cancellation that races with a successful payment recovers tickets without charging again', async () => {
  const env = setup(); env.setSDKResult({ error: { code: 'CANCELED' } }); env.setOffline(true);
  await assert.rejects(env.service.runDoorSaleTapToPay(params));
  env.setOffline(false);
  const result = await env.reload().resolvePendingTapPayment('operator');
  assert.equal(result.success, true);
  assert.equal(env.verified.at(-1).action, 'cancel');
  assert.equal(env.counts().processed, 1);
  assert.equal(env.storage.size, 0);
});

test('a lost creation response is recovered after restart with the saved request and no extra payment', async () => {
  const env = setup(); env.loseCreateResponse(true);
  await assert.rejects(env.service.runDoorSaleTapToPay(params), /response lost/);
  const draft = await env.service.getPendingTapPayment('operator');
  assert.ok(draft.requestId);
  assert.equal(draft.paymentIntentId, undefined);
  assert.equal(env.counts().processed, 0);
  assert.equal(env.counts().created, 1);

  const service = env.reload();
  env.loseCreateResponse(false);
  env.setStatus({ success: false, orderId: 'order1', paymentStatus: 'requires_payment_method', retryAllowed: true, clientSecret: 'secret-never-store' });
  await service.resolvePendingTapPayment('operator');
  assert.equal(env.creationRequests[0].requestId, env.creationRequests[1].requestId);
  assert.equal(env.counts().created, 1);
  assert.equal(env.counts().processed, 0);
  const result = await service.runDoorSaleTapToPay({ ...params, retryPending: true });
  assert.equal(result.retryAllowed, true);
  assert.equal(env.counts().processed, 1);
  assert.equal(env.counts().created, 1);
});

test('a lost creation response can be cancelled without ever showing the card reader', async () => {
  const env = setup(); env.loseCreateResponse(true);
  await assert.rejects(env.service.runDoorSaleTapToPay(params));
  env.loseCreateResponse(false);
  env.setStatus({ success: false, orderId: 'order1', paymentStatus: 'canceled', cancelled: true });
  const result = await env.reload().resolvePendingTapPayment('operator', 'cancel');
  assert.equal(result.cancelled, true);
  assert.equal(env.counts().created, 1);
  assert.equal(env.counts().processed, 0);
  assert.equal(env.storage.size, 0);
});

test('losing the network after card processing recovers confirmed payment without tapping again', async () => {
  const env = setup(); env.setOffline(true);
  await assert.rejects(env.service.runDoorSaleTapToPay(params));
  env.setOffline(false);
  const result = await env.service.resolvePendingTapPayment('operator');
  assert.equal(result.success, true);
  assert.equal(env.counts().created, 1);
  assert.equal(env.counts().processed, 1);
});

test('a network error and disconnected reader retry only the existing payment after reconnection', async () => {
  const env = setup(); env.failSDK(); env.setOffline(true);
  await assert.rejects(env.service.runDoorSaleTapToPay(params));
  env.disconnect(); env.setOffline(false);
  env.setStatus({ success: false, orderId: 'order1', paymentStatus: 'requires_confirmation', retryAllowed: true, clientSecret: 'secret-never-store' });
  await env.service.runDoorSaleTapToPay({ ...params, retryPending: true });
  assert.equal(env.counts().connects, 2);
  assert.equal(env.counts().created, 1);
  assert.equal(env.counts().processed, 2);
  assert.equal(env.verified.at(-1).paymentIntentId, 'pi_test');
});

test('a purchase cannot be submitted if saving its recovery request fails', async () => {
  const env = setup(); env.failStorageWrite(1);
  await assert.rejects(env.service.runDoorSaleTapToPay(params), /storage unavailable/);
  assert.equal(env.counts().created, 0);
  assert.equal(env.counts().processed, 0);
});

test('failure to save the returned payment never starts the reader and can recover the original order', async () => {
  const env = setup(); env.failStorageWrite(2);
  await assert.rejects(env.service.runDoorSaleTapToPay(params), /storage unavailable/);
  assert.equal(env.counts().created, 1);
  assert.equal(env.counts().processed, 0);
  const draft = await env.service.getPendingTapPayment('operator');
  assert.ok(draft.requestId);
  assert.equal(draft.paymentIntentId, undefined);
  await env.reload().resolvePendingTapPayment('operator');
  assert.equal(env.counts().created, 1);
  assert.equal(env.counts().processed, 0);
});

test('pending purchases saved by the previous app version are still verified without creating another payment', async () => {
  const env = setup();
  env.storage.set('lp_pending_tap_v1:operator', JSON.stringify({ orderId: 'order1', paymentIntentId: 'pi_test', eventId: 'event1', quantity: 1 }));
  assert.equal((await env.service.resolvePendingTapPayment('operator')).success, true);
  assert.equal(env.counts().created, 0);
  assert.equal(env.counts().processed, 0);
});
