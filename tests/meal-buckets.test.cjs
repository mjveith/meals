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
  assert.doesNotThrow(() => buckets.normalizeBucketPlan({ schemaVersion: 2, buckets: { lunch: [null, { id: 3 }] } }, preferences()));
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
