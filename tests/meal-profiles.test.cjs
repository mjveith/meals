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
    const candidates = [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      `${base}.json`,
      path.join(base, 'index.ts')
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
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

const { createHouseholdMembers } = require(path.join(projectRoot, 'src/lib/household.ts'));
const { DEFAULT_PREFERENCES } = require(path.join(projectRoot, 'src/lib/constants.ts'));
const { getSafeRecipes, createPlanFromConfig } = require(path.join(projectRoot, 'src/lib/meal-generator.ts'));
const { normalizeMealProfileId } = require(path.join(projectRoot, 'src/lib/meal-profiles.ts'));

function createPreferences(overrides = {}) {
  return {
    ...DEFAULT_PREFERENCES,
    selectedProteins: ['fish', 'pork', 'red-meat', 'chicken'],
    favoriteProteins: [],
    favoriteRecipeIds: [],
    adults: 2,
    children: 0,
    householdMembers: createHouseholdMembers(2, 0),
    excludedIngredients: ['pistachio', 'cashew'],
    ...overrides
  };
}

test('Home profile preserves the existing repository while Bajan inherits Home plus Bajan candidates', () => {
  const homeRecipes = getSafeRecipes([], [], 'home');
  const bajanRecipes = getSafeRecipes([], [], 'bajan');

  assert.equal(homeRecipes.some((recipe) => recipe.id.startsWith('bajan-')), false);
  assert.ok(bajanRecipes.some((recipe) => recipe.id === 'bajan-flying-fish-cutters'));
  assert.ok(bajanRecipes.some((recipe) => recipe.id === homeRecipes[0].id));
  assert.ok(bajanRecipes.length > homeRecipes.length);
});

test('Bajan generation uses Bajan repository candidates while Home remains unchanged', () => {
  const dayConfigs = Array.from({ length: 7 }, () => ({
    enabled: true,
    breakfast: false,
    brunch: false,
    lunch: true,
    dinner: true
  }));

  const homePlan = createPlanFromConfig(createPreferences({ mealProfileId: 'home' }), dayConfigs, []);
  const bajanPlan = createPlanFromConfig(createPreferences({ mealProfileId: 'bajan' }), dayConfigs, []);
  const homeIds = homePlan.days.flatMap((day) => Object.values(day.meals).map((slot) => slot.recipeId).filter(Boolean));
  const bajanIds = bajanPlan.days.flatMap((day) => Object.values(day.meals).map((slot) => slot.recipeId).filter(Boolean));

  assert.equal(homeIds.some((id) => id.startsWith('bajan-')), false);
  assert.ok(bajanIds.some((id) => id.startsWith('bajan-')));
});

test('meal profile selection has a persisted default and normalizes stored preference values', () => {
  assert.equal(DEFAULT_PREFERENCES.mealProfileId, 'home');
  assert.equal(normalizeMealProfileId('bajan'), 'bajan');
  assert.equal(normalizeMealProfileId('unknown-profile'), 'home');
  assert.equal(normalizeMealProfileId(undefined), 'home');
});
