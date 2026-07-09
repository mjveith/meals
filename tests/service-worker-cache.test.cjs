// Verifies the service worker's cache-eligibility predicate directly against
// the real public/sw.js source (extracted + evaluated in a vm sandbox), so the
// critical invariant "never cache /api/*" is guarded by CI.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadIsNeverCacheable() {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'sw.js'),
    'utf8'
  );
  const match = source.match(/function isNeverCacheable[\s\S]*?\n}/);
  assert.ok(match, 'isNeverCacheable function should exist in public/sw.js');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`${match[0]}\nthis.isNeverCacheable = isNeverCacheable;`, sandbox);
  return sandbox.isNeverCacheable;
}

test('service worker never caches /api/* requests', () => {
  const isNeverCacheable = loadIsNeverCacheable();
  assert.equal(isNeverCacheable(new URL('https://home.local/api/state')), true);
  assert.equal(isNeverCacheable(new URL('https://home.local/api/anything/else')), true);
});

test('service worker allows caching of static same-origin assets', () => {
  const isNeverCacheable = loadIsNeverCacheable();
  assert.equal(isNeverCacheable(new URL('https://home.local/')), false);
  assert.equal(isNeverCacheable(new URL('https://home.local/icon-192.png')), false);
  assert.equal(isNeverCacheable(new URL('https://home.local/_next/static/chunk.js')), false);
});
