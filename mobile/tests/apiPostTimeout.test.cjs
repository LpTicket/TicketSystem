const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/services/api.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText;
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };

function setup(fetch) {
  const timers = new Map();
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, fetch, AbortController, process: { env: { EXPO_PUBLIC_API_URL: 'https://test.invalid/api' } },
    setTimeout: fn => { const id = Symbol(); timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id),
    require: () => ({ getItem: async () => null }),
  });
  return { api: exports, timers, expire: () => [...timers.values()].forEach(fn => fn()) };
}
function interrupted(signal) {
  return new Promise((_resolve, reject) => {
    const error = new Error('Network interrupted'); error.name = 'AbortError';
    if (signal.aborted) reject(error);
    else signal.addEventListener('abort', () => reject(error), { once: true });
  });
}

test('a POST times out if connectivity is lost while reading its response after headers arrived', async () => {
  let reads = 0;
  const env = setup(async (_url, { signal }) => ({
    ok: true, status: 200, text: () => { reads++; return interrupted(signal); },
  }));
  const request = env.api.apiPost('/orders/door-sale/tap-to-pay-status', {});
  const rejected = assert.rejects(request, { name: 'AbortError' });
  await flush();
  assert.equal(reads, 1);
  assert.equal(env.timers.size, 1);
  env.expire(); await rejected;
  assert.equal(env.timers.size, 0);
});

test('a POST also times out before the server sends headers', async () => {
  const env = setup((_url, { signal }) => interrupted(signal));
  const rejected = assert.rejects(env.api.apiPost('/orders/door-sale/tap-to-pay-intent', {}), { name: 'AbortError' });
  await flush(); env.expire(); await rejected;
  assert.equal(env.timers.size, 0);
});

test('a complete POST response clears its deadline and returns the parsed result', async () => {
  const env = setup(async () => ({ ok: true, status: 200, text: async () => '{"success":true}' }));
  const result = await env.api.apiPost('/orders/door-sale/tap-to-pay-status', {});
  assert.equal(result.success, true);
  assert.equal(env.timers.size, 0);
});

test('the same POST deadline also interrupts a stalled session refresh', async () => {
  const signals = [];
  const env = setup(async (url, { signal }) => {
    signals.push(signal);
    if (url.endsWith('/auth/refresh')) return { ok: true, json: () => interrupted(signal) };
    return { ok: false, status: 401, headers: { get: () => null }, json: async () => ({ message: 'expired' }) };
  });
  env.api.setAuthTokens('expired-test-token', 'test-refresh-token');
  const rejected = assert.rejects(env.api.apiPost('/orders/door-sale/tap-to-pay-status', {}), error => error.status === 401);
  await flush();
  assert.equal(signals.length, 2);
  assert.equal(signals[0], signals[1]);
  env.expire(); await rejected;
  assert.equal(env.timers.size, 0);
});
