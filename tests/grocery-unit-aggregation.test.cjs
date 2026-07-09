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
    const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')];

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
      },
      fileName: filename,
    });

    module._compile(output.outputText, filename);
  };
}

const recipes = require(path.join(projectRoot, 'src/data/recipes.json'));
const { DEFAULT_PREFERENCES } = require(path.join(projectRoot, 'src/lib/constants.ts'));
const { buildGroceryList, UNIT_CONVERSIONS } = require(path.join(projectRoot, 'src/lib/grocery-builder.ts'));

function createCustomRecipe(id, ingredients) {
  return {
    id,
    isCustom: true,
    name: id,
    description: 'Test recipe',
    mealType: ['dinner'],
    proteins: [],
    cuisine: 'Test',
    prepTime: 0,
    cookTime: 0,
    servings: 4,
    ingredients,
    instructions: ['Cook it'],
  };
}

function createPlan(recipeIds) {
  return {
    weekOf: '2026-07-09',
    days: recipeIds.map((recipeId, index) => ({
      date: `2026-07-${String(9 + index).padStart(2, '0')}`,
      meals: {
        breakfast: { enabled: false },
        lunch: { enabled: false },
        dinner: { enabled: true, recipeId },
      },
    })),
  };
}

function buildTestList(customRecipes, customStaples = []) {
  return buildGroceryList(
    createPlan(customRecipes.map((recipe) => recipe.id)),
    {},
    customRecipes,
    1,
    customStaples,
    DEFAULT_PREFERENCES.sectionOrder
  );
}

test('recipes.json only uses canonicalized units or explicitly intentional unit-like counts', () => {
  const intentionallyUnitLike = new Set(['can', 'clove', 'count', 'head', 'pack', 'slice', 'stalk']);
  const recipeUnits = new Set(
    recipes.flatMap((recipe) => recipe.ingredients.map((ingredient) => ingredient.unit.trim().toLowerCase()))
  );

  const unknownUnits = [...recipeUnits]
    .filter((unit) => !Object.prototype.hasOwnProperty.call(UNIT_CONVERSIONS, unit))
    .filter((unit) => !intentionallyUnitLike.has(unit))
    .sort();

  assert.deepEqual(unknownUnits, []);
});

test('cup and quart recipe quantities merge into one canonical cup grocery item', () => {
  const groceries = buildTestList([
    createCustomRecipe('milk-cups', [
      { name: 'milk', quantity: 2, unit: 'cups', category: 'dairy' },
    ]),
    createCustomRecipe('milk-quarts', [
      { name: 'milk', quantity: 1, unit: 'quart', category: 'dairy' },
    ]),
  ]);

  const milkItems = groceries.filter((item) => item.name === 'milk');

  assert.equal(milkItems.length, 1);
  assert.equal(milkItems[0].unit, 'cup');
  assert.equal(milkItems[0].quantity, 6);
});

test('gallon staple name-merge adds converted cups to an existing cup grocery item', () => {
  const groceries = buildTestList(
    [
      createCustomRecipe('milk-cups', [
        { name: 'milk', quantity: 2, unit: 'cups', category: 'dairy' },
      ]),
    ],
    [{ name: 'milk', quantity: 1, unit: 'gallon', category: 'dairy' }]
  );

  const milkItems = groceries.filter((item) => item.name === 'milk');

  assert.equal(milkItems.length, 1);
  assert.equal(milkItems[0].unit, 'cup');
  assert.equal(milkItems[0].quantity, 18);
  assert.equal(milkItems[0].isStaple, true);
});

test('staple with matching name but mismatched unit does not merge into wrong grocery item', () => {
  const groceries = buildTestList(
    [
      createCustomRecipe('milk-cups', [
        { name: 'milk', quantity: 2, unit: 'cups', category: 'dairy' },
      ]),
    ],
    [{ name: 'milk', quantity: 1, unit: 'count', category: 'dairy' }]
  );

  const milkItems = groceries.filter((item) => item.name === 'milk');

  assert.equal(milkItems.length, 2);
  assert.deepEqual(
    milkItems.map((item) => [item.unit, item.quantity, item.isStaple]).sort(),
    [
      ['count', 1, true],
      ['cup', 2, false],
    ]
  );
});
