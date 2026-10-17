const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Execute the screen's actual loader without loading native payment modules.
const source = fs.readFileSync(path.join(__dirname, '../src/screens/DoorSaleScreen.tsx'), 'utf8');
const ast = ts.createSourceFile('DoorSaleScreen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let loader;
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'loadEvents') loader = node.initializer.getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(loader, 'Door sale event loader must exist');
const helpers = ast.statements.filter((node) => ts.isFunctionDeclaration(node)
  && ['listFrom', 'normalizeDoorEvent', 'mergeDoorEvents'].includes(node.name?.text));
const compiled = ts.transpileModule(`${helpers.map((node) => node.getText(ast)).join('\n')}\nconst load = ${loader};`, {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
}).outputText;

function setup({ user = { id: 'seller', role: 'client' }, eventSource = 'organizer', assignedEvents,
  pages = [], ownEvents = [], grants = [], failure } = {}) {
  const requests = [];
  const context = vm.createContext({
    user, eventSource, assignedEvents,
    getImageUrl: (value) => value,
    getMyScannerAccess: async () => grants,
    apiGet: async (url, params) => {
      requests.push({ url, params });
      if (failure) throw failure;
      if (url === '/admin/events') return pages[params.page - 1];
      assert.equal(url, '/events/mine/list');
      return ownEvents;
    },
  });
  vm.runInContext(compiled, context);
  return { load: () => vm.runInContext('load()', context), requests };
}

const published = (id, organizerId = 'other-organizer') => ({ id, title: id, organizerId, status: 'published' });

for (const eventSource of ['organizer', 'employee']) {
  test(`administrator can select other organizers' events from ${eventSource} entry`, async () => {
    const env = setup({ user: { id: 'admin', role: 'admin' }, eventSource,
      assignedEvents: [published('assigned-only')],
      pages: [{ events: [published('own', 'admin'), published('other'), { id: 'draft', status: 'draft' }], totalPages: 2 },
        { events: [published('last-page'), { ...published('past'), eventDate: '2020-01-01', status: 'completed' },
          { ...published('hidden'), publicVisible: false }, { id: 'cancelled', status: 'cancelled' }], totalPages: 2 }],
    });
    const events = await env.load();
    assert.deepEqual(Array.from(events, (event) => event.id), ['own', 'other', 'last-page', 'past']);
    assert.equal(events[1].organizerId, 'other-organizer');
    assert.equal(env.requests.length, 2);
    env.requests.forEach(({ url, params }, index) => {
      assert.equal(url, '/admin/events');
      assert.equal(params.status, undefined);
      assert.equal(params.page, index + 1);
      assert.equal(params.limit, 50);
    });
  });
}

test('organizer only receives their own visible published events', async () => {
  const env = setup({ ownEvents: [published('own', 'seller'), { id: 'draft', status: 'draft' },
    { ...published('hidden', 'seller'), publicVisible: false }] });
  assert.deepEqual(Array.from(await env.load(), (event) => event.id), ['own']);
  assert.equal(env.requests.length, 1);
  assert.equal(env.requests[0].url, '/events/mine/list');
});

test('employee receives own and approved events without duplicates or pending grants', async () => {
  const env = setup({ eventSource: 'employee', ownEvents: [published('own', 'seller')], grants: [
    { status: 'approved', event: published('own', 'seller') },
    { status: 'approved', event: published('approved') },
    { status: 'pending', event: published('pending') },
    { status: 'approved', event: { ...published('hidden'), publicVisible: false } },
  ] });
  assert.deepEqual(Array.from(await env.load(), (event) => event.id), ['own', 'approved']);
  assert.equal(env.requests[0].url, '/events/mine/list');
});

test('explicit event assignment still limits employees', async () => {
  const env = setup({ eventSource: 'employee', assignedEvents: [published('assigned'), { ...published('hidden'), publicVisible: false }] });
  assert.deepEqual(Array.from(await env.load(), (event) => event.id), ['assigned']);
  assert.equal(env.requests.length, 0);
});

test('empty admin list stops after the first page', async () => {
  const env = setup({ user: { id: 'admin', role: 'admin' }, pages: [{ events: [], totalPages: 0 }] });
  assert.equal((await env.load()).length, 0);
  assert.equal(env.requests.length, 1);
});

test('admin list failure surfaces instead of silently returning only own events', async () => {
  const failure = new Error('Cannot load administrative events');
  const env = setup({ user: { id: 'admin', role: 'admin' }, failure });
  await assert.rejects(env.load(), failure);
  assert.equal(env.requests.length, 1);
});
