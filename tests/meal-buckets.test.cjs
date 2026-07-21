const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '..');
const srcRoot = path.join(projectRoot, 'src');
const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    const base = path.join(srcRoot, request.slice(2));
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}.json`, path.join(base, 'index.ts')]) {
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = function compileTs(module, filename) {
    const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, resolveJsonModule: true },
      fileName: filename
    });
    module._compile(output.outputText, filename);
  };
}

const { createHouseholdMembers } = require(path.join(projectRoot, 'src/lib/household.ts'));
const buckets = require(path.join(projectRoot, 'src/lib/meal-buckets.ts'));

function preferences(overrides = {}) {
  return {
    selectedProteins: ['fish', 'pork', 'red-meat', 'chicken'], favoriteProteins: [], theme: 'system', favoriteRecipeIds: [],
    adults: 2, children: 0, householdMembers: createHouseholdMembers(2, 0), customStaples: [], brunchMode: false,
    sectionOrder: ['produce', 'protein', 'dairy', 'pantry', 'spice', 'bakery', 'frozen', 'beverage', 'household', 'other'],
    excludedIngredients: [], mealProfileId: 'home', ...overrides
  };
}

const allCounts = { breakfast: 2, brunch: 1, lunch: 3, dinner: 4 };
const countEntries = (plan) => Object.values(plan.buckets).reduce((total, entries) => total + entries.length, 0);

test('normalizes bucket counts independently, clamps them, and rejects an empty creation request', () => {
  const unavailable = preferences({ householdMembers: createHouseholdMembers(0, 0) });
  assert.deepEqual(buckets.normalizeMealCounts({ breakfast: 1.9, brunch: -2, lunch: 99, dinner: '4' }, unavailable), {
    breakfast: 0, brunch: 0, lunch: 0, dinner: 0
  });
  assert.deepEqual(buckets.normalizeMealCounts({ breakfast: 1.9, brunch: -2, lunch: 99, dinner: '4' }, preferences()), {
    breakfast: 1, brunch: 0, lunch: 50, dinner: 0
  });
  assert.throws(() => buckets.createBucketPlan(preferences(), {}), /at least one meal/i);
});

test('creates independent meal buckets with exact safe eligible recipe counts and stable unique IDs', () => {
  const plan = buckets.createBucketPlan(preferences({ excludedIngredients: ['pistachios'] }), allCounts);
  assert.equal(plan.schemaVersion, 2);
  assert.deepEqual(Object.fromEntries(Object.entries(plan.buckets).map(([type, meals]) => [type, meals.length])), allCounts);
  assert.equal(countEntries(plan), 10);
  assert.equal(new Set(Object.values(plan.buckets).flat().map((meal) => meal.id)).size, 10);
  for (const [mealType, meals] of Object.entries(plan.buckets)) {
    for (const meal of meals) {
      assert.ok(meal.recipeId);
      assert.equal(meal.mealType, mealType);
      assert.equal(meal.unsafeRecipeId, undefined);
    }
  }
});

test('uses one canonical lunch and dinner freshness context for every generated meal', () => {
  const requestedCounts = { breakfast: 1, brunch: 1, lunch: 2, dinner: 3 };
  assert.deepEqual(buckets.getLunchDinnerFreshnessContext(requestedCounts, 'breakfast', 0), undefined);
  assert.deepEqual(buckets.getLunchDinnerFreshnessContext(requestedCounts, 'lunch', 0), { ordinal: 0, total: 5 });
  assert.deepEqual(buckets.getLunchDinnerFreshnessContext(requestedCounts, 'lunch', 1), { ordinal: 1, total: 5 });
  assert.deepEqual(buckets.getLunchDinnerFreshnessContext(requestedCounts, 'dinner', 0), { ordinal: 2, total: 5 });
  assert.deepEqual(buckets.getLunchDinnerFreshnessContext(requestedCounts, 'dinner', 2), { ordinal: 4, total: 5 });
});

test('migrates enabled legacy slots in date order with deterministic IDs and tolerates malformed raw plans', () => {
  const legacy = { weekOf: '2026-04-06', days: [
    { date: '2026-04-07', meals: { breakfast: { enabled: true, recipeId: 'strawberry-ricotta-toast' }, brunch: { enabled: false, recipeId: 'x' }, lunch: { enabled: true, unsafeRecipeId: 'bad', unsafeExcludedIngredients: ['nuts'], consumed: true }, dinner: { enabled: true, recipeId: 'sheet-pan-garlic-salmon' } } },
    { date: '2026-04-08', meals: { breakfast: { enabled: false }, brunch: { enabled: true, recipeId: 'strawberry-ricotta-toast' }, lunch: null, dinner: { enabled: false } } }
  ] };
  const migrated = buckets.normalizeBucketPlan(legacy, preferences());
  assert.equal(migrated.schemaVersion, 2);
  assert.deepEqual(migrated.buckets.breakfast.map((meal) => meal.recipeId), ['strawberry-ricotta-toast']);
  assert.deepEqual(migrated.buckets.brunch.map((meal) => meal.recipeId), ['strawberry-ricotta-toast']);
  assert.equal(migrated.buckets.lunch[0].unsafeRecipeId, 'bad');
  assert.equal(migrated.buckets.lunch[0].consumed, true);
  assert.equal(migrated.buckets.dinner[0].recipeId, 'sheet-pan-garlic-salmon');
  assert.deepEqual(buckets.normalizeBucketPlan(migrated, preferences()), migrated);
  assert.equal(buckets.normalizeBucketPlan({ schemaVersion: 2, buckets: { lunch: [null, { id: 3 }] } }, preferences()), null);
});

test('normalizes persisted counts from bucket contents even after household availability changes', () => {
  const persisted = {
    schemaVersion: 2, id: 'persisted-plan', createdAt: '2026-04-06T00:00:00.000Z',
    requestedCounts: { breakfast: 50, brunch: 50, lunch: 50, dinner: 50 },
    buckets: {
      breakfast: [{ id: 'breakfast-1', recipeId: 'strawberry-ricotta-toast' }], brunch: [],
      lunch: [{ id: 'lunch-1', recipeId: 'mediterranean-chicken-pitas' }],
      dinner: [{ id: 'dinner-1', recipeId: 'sheet-pan-garlic-salmon' }, { id: 'dinner-2', recipeId: 'one-pot-coconut-chicken-rice' }]
    }
  };
  const normalized = buckets.normalizeBucketPlan(persisted, preferences({ householdMembers: createHouseholdMembers(0, 0) }));
  assert.deepEqual(normalized.requestedCounts, { breakfast: 1, brunch: 0, lunch: 1, dinner: 2 });
  assert.equal(countEntries(normalized), 4);
});

test('returns null for absent or structurally unrecognized bucket data', () => {
  assert.equal(buckets.normalizeBucketPlan(null, preferences()), null);
  assert.equal(buckets.normalizeBucketPlan('not-a-plan', preferences()), null);
  assert.equal(buckets.normalizeBucketPlan({ hello: 'world' }, preferences()), null);
  assert.equal(buckets.normalizeBucketPlan({ schemaVersion: 2, id: 'empty', createdAt: '2026-04-06T00:00:00.000Z', buckets: {} }, preferences()), null);
  assert.equal(buckets.normalizeBucketPlan({ days: [] }, preferences()), null);
});

test('uses valid deterministic timestamps and unique IDs when normalizing hostile plans', () => {
  const legacy = buckets.normalizeBucketPlan({ weekOf: 'not-a-date', days: [{ meals: { lunch: { enabled: true, recipeId: 'mediterranean-chicken-pitas' } } }] }, preferences());
  assert.equal(legacy.createdAt, '1970-01-01T00:00:00.000Z');
  assert.ok(Number.isFinite(Date.parse(legacy.createdAt)));

  const normalized = buckets.normalizeBucketPlan({
    schemaVersion: 2, id: 'hostile', createdAt: 'invalid',
    buckets: {
      breakfast: [{ id: 'duplicate', recipeId: 'strawberry-ricotta-toast' }, { id: 'duplicate', recipeId: 'strawberry-ricotta-toast' }],
      brunch: [{ recipeId: 'strawberry-ricotta-toast' }],
      lunch: [{ id: 'duplicate', recipeId: 'mediterranean-chicken-pitas' }], dinner: []
    }
  }, preferences());
  const meals = Object.values(normalized.buckets).flat();
  assert.equal(normalized.createdAt, '1970-01-01T00:00:00.000Z');
  assert.equal(meals[0].id, 'duplicate');
  assert.equal(new Set(meals.map((meal) => meal.id)).size, meals.length);
  assert.deepEqual(normalized.requestedCounts, { breakfast: 2, brunch: 1, lunch: 1, dinner: 0 });

  const preservesUniqueId = buckets.normalizeBucketPlan({
    schemaVersion: 2, buckets: {
      breakfast: [{ recipeId: 'strawberry-ricotta-toast' }],
      brunch: [{ id: 'bucket-normalized-breakfast-1', recipeId: 'strawberry-ricotta-toast' }], lunch: [], dinner: []
    }
  }, preferences());
  assert.equal(preservesUniqueId.buckets.brunch[0].id, 'bucket-normalized-breakfast-1');
  assert.notEqual(preservesUniqueId.buckets.breakfast[0].id, 'bucket-normalized-breakfast-1');
});

test('bucket actions protect consumed entries, validate assignments, and report completion', () => {
  let plan = buckets.createBucketPlan(preferences(), { breakfast: 0, brunch: 0, lunch: 2, dinner: 1 });
  const lunchId = plan.buckets.lunch[0].id;
  const consumed = buckets.toggleBucketMealConsumed(plan, lunchId, true);
  assert.equal(consumed.buckets.lunch[0].consumed, true);
  assert.ok(consumed.buckets.lunch[0].consumedAt);
  assert.equal(buckets.assignBucketMealRecipe(consumed, lunchId, 'mediterranean-chicken-pitas', preferences()), consumed);
  assert.equal(buckets.regenerateBucketMeal(consumed, lunchId, preferences()), consumed);
  assert.equal(buckets.assignBucketMealRecipe(plan, lunchId, 'strawberry-ricotta-toast', preferences()), plan);
  const assigned = buckets.assignBucketMealRecipe(plan, lunchId, 'mediterranean-chicken-pitas', preferences());
  assert.equal(assigned.buckets.lunch[0].recipeId, 'mediterranean-chicken-pitas');
  const regenerated = buckets.regenerateAllBucketMeals(consumed, preferences());
  assert.deepEqual(regenerated.buckets.lunch[0], consumed.buckets.lunch[0]);
  assert.equal(buckets.getBucketMealCompletion(consumed).completed, 1);
  assert.equal(buckets.getBucketMealCompletion(consumed).remaining, 2);
  assert.equal(buckets.toggleBucketMealConsumed(plan, 'missing'), plan);
});

test('reconciles bucket allergen safety through a safe-unsafe-safe round trip without losing consumption', () => {
  const recipe = {
    id: 'custom-pistachio-lunch', name: 'Pistachio Lunch', description: 'Test', mealType: ['lunch'], proteins: ['chicken'],
    cuisine: 'Test', prepTime: 1, cookTime: 1, servings: 1, difficulty: 'easy',
    ingredients: [{ name: 'Pistachios', quantity: 1, unit: 'cup', category: 'pantry' }], instructions: ['Serve'], isCustom: true
  };
  const plan = {
    schemaVersion: 2, id: 'safety-plan', createdAt: '2026-05-01T00:00:00.000Z', requestedCounts: { breakfast: 0, brunch: 0, lunch: 1, dinner: 0 },
    buckets: { breakfast: [], brunch: [], lunch: [{ id: 'meal-1', mealType: 'lunch', recipeId: recipe.id, consumed: true, consumedAt: '2026-05-01T12:00:00.000Z' }], dinner: [] }
  };

  const unsafe = buckets.reconcileBucketPlanSafety(plan, preferences({ excludedIngredients: ['pistachio'], householdMembers: createHouseholdMembers(0, 0) }), [recipe]);
  assert.deepEqual(unsafe.buckets.lunch[0], {
    id: 'meal-1', mealType: 'lunch', unsafeRecipeId: recipe.id, unsafeExcludedIngredients: ['Pistachios'], consumed: true, consumedAt: '2026-05-01T12:00:00.000Z'
  });

  const safeAgain = buckets.reconcileBucketPlanSafety(unsafe, preferences({ householdMembers: createHouseholdMembers(0, 0) }), [recipe]);
  assert.deepEqual(safeAgain.buckets.lunch[0], {
    id: 'meal-1', mealType: 'lunch', recipeId: recipe.id, consumed: true, consumedAt: '2026-05-01T12:00:00.000Z'
  });
});

test('removing a recipe preserves every bucket entry and its consumption metadata as unavailable', () => {
  const plan = {
    schemaVersion: 2, id: 'remove-plan', createdAt: '2026-05-01T00:00:00.000Z', requestedCounts: { breakfast: 0, brunch: 0, lunch: 2, dinner: 0 },
    buckets: {
      breakfast: [], brunch: [],
      lunch: [
        { id: 'removed-meal', mealType: 'lunch', recipeId: 'custom-removed', consumed: true, consumedAt: '2026-05-02T12:00:00.000Z' },
        { id: 'kept-meal', mealType: 'lunch', recipeId: 'mediterranean-chicken-pitas' }
      ],
      dinner: []
    }
  };

  assert.deepEqual(buckets.removeRecipeFromBucketPlan(plan, 'custom-removed').buckets.lunch, [
    { id: 'removed-meal', mealType: 'lunch', unsafeRecipeId: 'custom-removed', consumed: true, consumedAt: '2026-05-02T12:00:00.000Z' },
    { id: 'kept-meal', mealType: 'lunch', recipeId: 'mediterranean-chicken-pitas' }
  ]);
});

test('regenerating remaining bucket meals preserves consumed entries', () => {
  const plan = buckets.createBucketPlan(preferences(), { breakfast: 0, brunch: 0, lunch: 2, dinner: 0 });
  const consumed = buckets.toggleBucketMealConsumed(plan, plan.buckets.lunch[0].id, true);
  const regenerated = buckets.regenerateAllBucketMeals(consumed, preferences());
  assert.deepEqual(regenerated.buckets.lunch[0], consumed.buckets.lunch[0]);
});
