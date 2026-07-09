const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '..');
const srcRoot = path.join(projectRoot, 'src');
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    const base = path.join(srcRoot, request.slice(2));
    const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.json`, path.join(base, 'index.ts')];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = function compileTs(module, filename) {
    const source = fs.readFileSync(filename, 'utf8');
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
        resolveJsonModule: true
      },
      fileName: filename
    });
    module._compile(output.outputText, filename);
  };
}

const {
  createStateStore,
  defaultState,
  maxHistorySnapshots,
  mergeStatePatch,
  sanitizeState
} = require(path.join(projectRoot, 'src/lib/state-store.ts'));

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'meals-state-store-'));
}

function createSavedWeek(id, savedAt) {
  return {
    id,
    savedAt,
    weekOf: '2026-07-06',
    label: `Week ${id}`,
    mealPlan: { weekOf: '2026-07-06', days: [] },
    groceryList: [],
    customGroceryItems: []
  };
}

test('readStateRecord creates a default state file on first read', async () => {
  const dir = tempDir();
  const store = createStateStore(dir);

  const record = await store.readStateRecord();

  assert.equal(record.version, 0);
  assert.deepEqual(record.state, defaultState);
  assert.equal(fs.existsSync(path.join(dir, 'meals-state.json')), true);
  const stored = JSON.parse(fs.readFileSync(path.join(dir, 'meals-state.json'), 'utf8'));
  assert.equal(stored.stateVersion, 0);
});

test('writeStateRecord writes atomically, backs up previous state, and caps history snapshots', async () => {
  const dir = tempDir();
  const store = createStateStore(dir);
  let current = await store.readStateRecord();

  for (let index = 0; index < maxHistorySnapshots + 5; index += 1) {
    const nextState = sanitizeState({
      ...current.state,
      preferences: { ...current.state.preferences, brunchMode: index % 2 === 0 }
    });
    current = await store.writeStateRecord(nextState, current.version);
  }

  assert.equal(fs.existsSync(path.join(dir, 'meals-state.json.tmp')), false);
  assert.equal(fs.existsSync(path.join(dir, 'meals-state.backup.json')), true);
  const backup = JSON.parse(fs.readFileSync(path.join(dir, 'meals-state.backup.json'), 'utf8'));
  assert.equal(backup.stateVersion, maxHistorySnapshots + 4);
  const snapshots = fs.readdirSync(path.join(dir, 'meals-state-history')).filter((entry) => entry.endsWith('.json'));
  assert.equal(snapshots.length, maxHistorySnapshots);
});

test('sanitizeState normalizes malformed persisted input', () => {
  const sanitized = sanitizeState({
    preferences: {
      ...defaultState.preferences,
      adults: Number.NaN,
      children: 99,
      householdMembers: 'bad',
      customStaples: [
        { name: ' Milk ', quantity: 1, unit: ' gallon ', category: 'dairy' },
        { name: 'Milk', quantity: 1, unit: 'gallon', category: 'dairy' }
      ],
      sectionOrder: ['dairy', 'bad', 'produce', 'dairy']
    },
    groceryOverrides: { milk: { adjustment: 1, collected: true }, bad: { adjustment: Number.NaN } },
    customGroceryItems: [{ id: 'x', name: ' Apples ', quantity: '2', unit: ' lb ', category: 'produce', collected: 1 }],
    customRecipes: [{ id: 'bad', name: '', mealType: ['snack'] }],
    savedWeeks: []
  });

  assert.deepEqual(sanitized.preferences.sectionOrder, ['dairy', 'other', 'produce', 'protein', 'pantry', 'spice', 'bakery', 'frozen', 'beverage', 'household']);
  assert.equal(sanitized.preferences.customStaples.length, 1);
  assert.deepEqual(sanitized.groceryOverrides, { milk: { adjustment: 1, collected: true } });
  assert.deepEqual(sanitized.customGroceryItems, [{ id: 'x', name: 'Apples', quantity: 2, unit: 'lb', category: 'produce', collected: true }]);
  assert.deepEqual(sanitized.customRecipes, []);
});

test('mergeStatePatch keeps tombstone guards for custom staples and saved weeks', () => {
  const staple = { name: 'Milk', quantity: 1, unit: 'gallon', category: 'dairy' };
  const older = createSavedWeek('older', '2026-07-01T00:00:00.000Z');
  const deleted = createSavedWeek('deleted', '2026-07-02T00:00:00.000Z');
  const newer = createSavedWeek('newer', '2026-07-03T00:00:00.000Z');
  const current = sanitizeState({
    ...defaultState,
    preferences: { ...defaultState.preferences, customStaples: [staple] },
    savedWeeks: [newer, deleted, older]
  });

  const legacyPatch = mergeStatePatch(current, { preferences: { ...current.preferences, customStaples: [] } });
  assert.deepEqual(legacyPatch.preferences.customStaples, [staple]);

  const explicitPatch = mergeStatePatch(current, {
    preferences: { ...current.preferences, customStaples: [] },
    customStaplesReplace: true,
    savedWeeks: [newer, older],
    savedWeekDeletedIds: ['deleted']
  });
  assert.deepEqual(explicitPatch.preferences.customStaples, []);
  assert.deepEqual(explicitPatch.savedWeeks.map((week) => week.id), ['newer', 'older']);
  assert.equal(Object.hasOwn(explicitPatch, 'customStaplesReplace'), false);
  assert.equal(Object.hasOwn(explicitPatch, 'savedWeekDeletedIds'), false);
});

test('stateVersion migrates from missing field and increments monotonically in same millisecond', async () => {
  const dir = tempDir();
  const store = createStateStore(dir);
  fs.writeFileSync(path.join(dir, 'meals-state.json'), `${JSON.stringify(defaultState, null, 2)}\n`);

  const initial = await store.readStateRecord();
  const first = await store.writeStateRecord(sanitizeState({ ...initial.state, preferences: { ...initial.state.preferences, brunchMode: true } }), initial.version);
  const second = await store.writeStateRecord(sanitizeState({ ...first.state, preferences: { ...first.state.preferences, brunchMode: false } }), first.version);

  assert.equal(initial.version, 0);
  assert.equal(first.version, 1);
  assert.equal(second.version, 2);
  assert.notEqual(first.raw, second.raw);
});

test('withStateLock serializes concurrent writes without lost updates', async () => {
  const dir = tempDir();
  const store = createStateStore(dir);
  const initial = await store.readStateRecord();

  await Promise.all([
    store.withStateLock(async () => {
      const current = await store.readStateRecord();
      const nextState = sanitizeState({
        ...current.state,
        preferences: { ...current.state.preferences, favoriteRecipeIds: [...current.state.preferences.favoriteRecipeIds, 'recipe-a'] }
      });
      return store.writeStateRecord(nextState, current.version);
    }),
    store.withStateLock(async () => {
      const current = await store.readStateRecord();
      const nextState = sanitizeState({
        ...current.state,
        preferences: { ...current.state.preferences, favoriteRecipeIds: [...current.state.preferences.favoriteRecipeIds, 'recipe-b'] }
      });
      return store.writeStateRecord(nextState, current.version);
    })
  ]);

  const finalRecord = await store.readStateRecord();
  assert.equal(finalRecord.version, initial.version + 2);
  assert.deepEqual(finalRecord.state.preferences.favoriteRecipeIds.sort(), ['recipe-a', 'recipe-b']);
});
