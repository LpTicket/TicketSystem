const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Run the screen's recovery effect with controlled storage/server responses.
// The payment service suite separately verifies real cancellation persistence.
const file = path.join(__dirname, '../src/screens/DoorSaleScreen.tsx');
const ast = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let recovery;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect'
    && node.arguments[0]?.getText(ast).includes('getPendingTapPayment(user.id)')) {
    recovery = node.arguments[0].getText(ast);
  }
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(recovery);
const compiled = ts.transpileModule(`const recover = ${recovery}; recover;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2020 },
}).outputText;
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const pending = { orderId: 'order1', paymentIntentId: 'pi_test', eventId: 'event1', quantity: 1 };

function setup({ stored = pending, result, error, deferred } = {}) {
  const state = {};
  const resolvedUsers = [];
  const applied = [];
  const errors = [];
  const context = {
    user: { id: 'operator' }, t: es => es,
    getPendingTapPayment: async () => stored,
    resolvePendingTapPayment: async userId => {
      resolvedUsers.push(userId);
      if (deferred) return deferred;
      if (error) throw error;
      return result;
    },
    applyTapResult: async value => applied.push(value),
    showUncertainPayment: async value => errors.push(value),
    setError: value => errors.push(value),
  };
  for (const name of ['PendingLoaded', 'PendingTap', 'SelectedEventId', 'PaymentMethod', 'Creating', 'TapPhase', 'TapStatus']) {
    context[`set${name}`] = value => { state[name] = value; };
  }
  const recover = vm.runInNewContext(compiled, context);
  return { start: recover, state, resolvedUsers, applied, errors };
}

test('reopening a pending sale checks the backend automatically before enabling another purchase', async () => {
  let finish;
  const deferred = new Promise(resolve => { finish = resolve; });
  const env = setup({ deferred });
  env.start(); await flush();
  assert.equal(env.state.PendingLoaded, false);
  assert.equal(env.state.Creating, true);
  assert.equal(env.state.PaymentMethod, 'tap');
  assert.equal(env.state.SelectedEventId, 'event1');
  assert.deepEqual(env.resolvedUsers, ['operator']);
  const result = { success: false, orderId: 'order1', paymentStatus: 'canceled', cancelled: true };
  finish(result); await flush();
  assert.deepEqual(env.applied, [result]);
  assert.equal(env.state.Creating, false);
  assert.equal(env.state.PendingLoaded, true);
});

test('a recovery network error exits progress and exposes the existing safe recovery actions', async () => {
  const error = new Error('offline');
  const env = setup({ error });
  env.start(); await flush();
  assert.deepEqual(env.errors, [error]);
  assert.equal(env.state.Creating, false);
  assert.equal(env.state.PendingLoaded, true);
  assert.equal(env.state.PendingTap, pending);
  assert.equal(env.applied.length, 0);
});

test('reopening without a pending purchase does not contact the payment-status endpoint', async () => {
  const env = setup({ stored: null });
  env.start(); await flush();
  assert.equal(env.state.PendingLoaded, true);
  assert.equal(env.resolvedUsers.length, 0);
});

test('leaving during recovery does not apply the result to an unmounted screen', async () => {
  let finish;
  const env = setup({ deferred: new Promise(resolve => { finish = resolve; }) });
  const dispose = env.start(); await flush(); dispose();
  finish({ success: true, paymentStatus: 'succeeded' }); await flush();
  assert.equal(env.applied.length, 0);
  assert.equal(env.errors.length, 0);
  assert.equal(env.state.PendingLoaded, false);
});
