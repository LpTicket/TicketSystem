const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exportsObject = {};
const code = ts.transpileModule(fs.readFileSync('src/lib/safeRedirect.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
vm.runInNewContext(code, { exports: exportsObject, URL });
const { safeRedirectPath } = exportsObject;

test('keeps a local purchase destination and its query parameters', () => {
  assert.equal(safeRedirectPath('/events/concert/purchase?quantity=2#tickets'), '/events/concert/purchase?quantity=2#tickets');
  assert.equal(safeRedirectPath('/dashboard?tab=tickets'), '/dashboard?tab=tickets');
});

test('rejects executable schemes, external origins and malformed paths', () => {
  for (const value of [null, '', 'javascript:alert(1)', 'https://outside.example', '//outside.example', '/\\outside.example', '/%5coutside.example', '/%2foutside.example', '/\n/outside.example', '/%ZZ']) {
    assert.equal(safeRedirectPath(value), '/', String(value));
  }
});
