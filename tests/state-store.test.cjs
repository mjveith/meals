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

test('sanitizeState normalizes hostile scalar preference fields so clients cannot be crashed', () => {
  const sanitized = sanitizeState({
    preferences: {
      ...defaultState.preferences,
      selectedProteins: 5,
      favoriteProteins: [{ evil: true }, 'chicken', 'chicken', 'not-a-protein'],
      favoriteRecipeIds: 'nope',
      brunchMode: 'truthy string'
    }
  });

  assert.deepEqual(sanitized.preferences.selectedProteins, defaultState.preferences.selectedProteins);
  assert.deepEqual(sanitized.preferences.favoriteProteins, ['chicken']);
  assert.deepEqual(sanitized.preferences.favoriteRecipeIds, []);
  assert.equal(sanitized.preferences.brunchMode, true);
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

test('sanitizeState migrates legacy plans and preserves consumed unsafe history deterministically', () => {
  const sanitized = sanitizeState({ mealPlan: { weekOf: '2026-04-06', days: [{ date: '2026-04-07', meals: { lunch: { enabled: true, unsafeRecipeId: 'removed-recipe', unsafeExcludedIngredients: ['cashew'], consumed: true }, dinner: { enabled: true, recipeId: 'sheet-pan-garlic-salmon' } } }] } });
  assert.equal(sanitized.mealPlan.schemaVersion, 2);
  assert.equal(sanitized.mealPlan.id, 'legacy-2026-04-06');
  assert.equal(sanitized.mealPlan.buckets.lunch[0].id, 'legacy-2026-04-06-0-lunch');
  assert.equal(sanitized.mealPlan.buckets.lunch[0].unsafeRecipeId, 'removed-recipe');
  assert.equal(sanitized.mealPlan.buckets.lunch[0].consumed, true);
});

test('sanitizeState preserves v2 IDs and counts while reconciling normalized allergen preferences', () => {
  const plan = { schemaVersion: 2, id: 'current-bucket', createdAt: '2026-04-06T00:00:00.000Z', requestedCounts: { breakfast: 99, brunch: 0, lunch: 0, dinner: 0 }, buckets: { breakfast: [{ id: 'breakfast-id', mealType: 'breakfast', recipeId: 'custom-cashew-toast', consumed: true }], brunch: [], lunch: [], dinner: [] } };
  const customRecipes = [{ id: 'custom-cashew-toast', isCustom: true, name: 'Cashew Toast', description: '', mealType: ['breakfast'], proteins: [], cuisine: '', prepTime: 1, cookTime: 1, servings: 1, difficulty: 'easy', ingredients: [{ name: 'cashews', quantity: 1, unit: 'cup', category: 'pantry' }], instructions: [] }];
  const sanitized = sanitizeState({ preferences: { ...defaultState.preferences, excludedIngredients: ['cashew'] }, mealPlan: plan, customRecipes });
  assert.deepEqual(sanitized.mealPlan.requestedCounts, { breakfast: 1, brunch: 0, lunch: 0, dinner: 0 });
  assert.equal(sanitized.mealPlan.buckets.breakfast[0].id, 'breakfast-id');
  assert.equal(sanitized.mealPlan.buckets.breakfast[0].unsafeRecipeId, 'custom-cashew-toast');
  assert.equal(sanitized.mealPlan.buckets.breakfast[0].consumed, true);
  assert.deepEqual(sanitizeState(sanitized).mealPlan, sanitized.mealPlan);
});

test('a legacy plan migration survives an unrelated preference write', async () => {
  const dir = tempDir();
  const store = createStateStore(dir);
  const legacyState = {
    ...defaultState,
    mealPlan: {
      weekOf: '2026-04-06',
      days: [{
        date: '2026-04-07',
        meals: {
          breakfast: { enabled: true, recipeId: 'strawberry-ricotta-toast' },
          lunch: { enabled: true, unsafeRecipeId: 'removed-recipe', unsafeExcludedIngredients: ['cashew'], consumed: true },
          dinner: { enabled: true, recipeId: 'sheet-pan-garlic-salmon' }
        }
      }]
    },
    savedWeeks: [createSavedWeek('legacy-archive', '2026-04-08T00:00:00.000Z')]
  };
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'meals-state.json'), `${JSON.stringify(legacyState, null, 2)}\n`);

  const migrated = await store.readStateRecord();
  assert.equal(migrated.state.mealPlan.schemaVersion, 2);
  assert.deepEqual(migrated.state.mealPlan.buckets.breakfast.map((meal) => meal.id), ['legacy-2026-04-06-0-breakfast']);
  assert.equal(migrated.state.mealPlan.buckets.lunch[0].id, 'legacy-2026-04-06-0-lunch');
  assert.equal(migrated.state.mealPlan.buckets.lunch[0].unsafeRecipeId, 'removed-recipe');
  assert.deepEqual(migrated.state.mealPlan.buckets.lunch[0].unsafeExcludedIngredients, ['cashew']);
  assert.equal(migrated.state.mealPlan.buckets.lunch[0].consumed, true);

  const patch = mergeStatePatch(migrated.state, { preferences: { ...migrated.state.preferences, brunchMode: true } });
  await store.writeStateRecord(sanitizeState({ ...migrated.state, ...patch }), migrated.version);

  const persisted = JSON.parse(fs.readFileSync(path.join(dir, 'meals-state.json'), 'utf8'));
  const reread = await store.readStateRecord();
  assert.equal(persisted.mealPlan.schemaVersion, 2);
  assert.equal(reread.state.mealPlan.schemaVersion, 2);
  assert.deepEqual(reread.state.mealPlan.buckets.breakfast.map((meal) => meal.id), ['legacy-2026-04-06-0-breakfast']);
  assert.equal(reread.state.mealPlan.buckets.lunch[0].id, 'legacy-2026-04-06-0-lunch');
  assert.equal(reread.state.mealPlan.buckets.lunch[0].unsafeRecipeId, 'removed-recipe');
  assert.equal(reread.state.mealPlan.buckets.lunch[0].consumed, true);
  assert.equal(reread.state.savedWeeks.length, 1);
  assert.equal(reread.state.savedWeeks[0].id, 'legacy-archive');
  assert.equal(reread.state.preferences.brunchMode, true);
});

test('sanitizeState safely normalizes mixed archives without rewriting historical legacy days', () => {
  const state = sanitizeState({ savedWeeks: [
    { id: 'legacy', savedAt: '2026-04-10T00:00:00.000Z', weekOf: '2026-04-06', label: 'Legacy', mealPlan: { weekOf: '2026-04-06', days: [{ date: '2026-04-06', meals: { lunch: { enabled: true, unsafeRecipeId: 'gone', consumed: true } } }] }, groceryList: [{ name: 'Milk', category: 'dairy' }], customGroceryItems: [{ id: 'item', name: ' Apples ', quantity: 2, unit: ' lb ', category: 'produce', collected: false }] },
    { kind: 'bucket-plan', schemaVersion: 1, id: 'bucket-archive', savedAt: '2026-04-10T00:00:00.000Z', label: 'Buckets', mealPlan: { schemaVersion: 2, id: 'saved-plan', createdAt: '2026-04-06T00:00:00.000Z', buckets: { breakfast: [{ id: 'saved-breakfast', recipeId: 'strawberry-ricotta-toast' }], brunch: [], lunch: [], dinner: [] } }, groceryList: [{ name: 'Bread', category: 'bakery' }], customGroceryItems: [] },
    null,
    { id: '', savedAt: 'bad' }
  ] });
  assert.equal(state.savedWeeks.length, 2);
  assert.equal(state.savedWeeks[0].mealPlan.days[0].meals.lunch.consumed, true);
  assert.equal(state.savedWeeks[0].customGroceryItems[0].name, 'Apples');
  assert.equal(state.savedWeeks[1].kind, 'bucket-plan');
  assert.equal(state.savedWeeks[1].mealPlan.schemaVersion, 2);
  assert.equal(state.savedWeeks[1].mealPlan.buckets.breakfast[0].id, 'saved-breakfast');
});
