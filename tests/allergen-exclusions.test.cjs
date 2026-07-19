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
    const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.json`, path.join(base, 'index.ts')];

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

const { DEFAULT_PREFERENCES } = require(path.join(projectRoot, 'src/lib/constants.ts'));
const { buildGroceryList } = require(path.join(projectRoot, 'src/lib/grocery-builder.ts'));
const { ingredientMatchesExcluded, recipeExcludedAllergens } = require(path.join(projectRoot, 'src/lib/allergens.ts'));
const { createPlanFromConfig, getSafeRecipes, syncPlanMealParticipation } = require(path.join(projectRoot, 'src/lib/meal-generator.ts'));

const excludedIngredients = ['pistachio', 'cashew'];

function customRecipe(id, name, ingredientName) {
  return {
    id,
    name,
    description: 'Test recipe',
    mealType: ['dinner'],
    proteins: ['chicken'],
    cuisine: 'Test Kitchen',
    prepTime: 5,
    cookTime: 10,
    servings: 4,
    difficulty: 'easy',
    ingredients: [
      { name: ingredientName, quantity: 1, unit: 'cup', category: 'pantry' }
    ],
    instructions: ['Cook'],
    isCustom: true
  };
}

test('allergen matching is case-insensitive and handles singular/plural variants', () => {
  assert.equal(ingredientMatchesExcluded('Chopped Pistachios', excludedIngredients), true);
  assert.equal(ingredientMatchesExcluded('CASHEW cream', excludedIngredients), true);
  assert.equal(ingredientMatchesExcluded('cashews', excludedIngredients), true);
  assert.equal(ingredientMatchesExcluded('cashmere sweater', excludedIngredients), false);
});

test('safe recipe pool excludes pistachios and cashews when selected', () => {
  const unsafeCashewRecipe = customRecipe('cashew-test', 'Cashew Curry', 'cashews');
  const safeRecipes = getSafeRecipes([unsafeCashewRecipe], excludedIngredients);

  assert.equal(safeRecipes.some((recipe) => recipe.id === 'strawberry-ricotta-toast'), true);
  assert.equal(safeRecipes.some((recipe) => recipe.id === 'cashew-test'), false);
});

test('strawberry ricotta recipe permanently uses sunflower seeds instead of pistachios', () => {
  const recipe = getSafeRecipes([], excludedIngredients).find((candidate) => candidate.id === 'strawberry-ricotta-toast');
  const recipeText = JSON.stringify(recipe).toLowerCase();

  assert.ok(recipe, 'expected Strawberry Ricotta Toast to remain in the safe recipe pool');
  assert.match(recipeText, /sunflower seed/);
  assert.doesNotMatch(recipeText, /pistachio/);
  assert.deepEqual(recipeExcludedAllergens(recipe, excludedIngredients), []);
});

test('generated plans never include selected pistachio or cashew allergens', () => {
  const preferences = {
    ...DEFAULT_PREFERENCES,
    excludedIngredients,
    favoriteRecipeIds: ['strawberry-ricotta-toast', 'cashew-test']
  };
  const plan = createPlanFromConfig(preferences, [
    { enabled: true, breakfast: true, lunch: true, dinner: true },
    { enabled: true, breakfast: true, lunch: true, dinner: true },
    { enabled: true, breakfast: true, lunch: true, dinner: true },
    { enabled: true, breakfast: true, lunch: true, dinner: true },
    { enabled: true, breakfast: true, lunch: true, dinner: true },
    { enabled: true, breakfast: true, lunch: true, dinner: true },
    { enabled: true, breakfast: true, lunch: true, dinner: true }
  ], [customRecipe('cashew-test', 'Cashew Curry', 'cashew')]);

  const safeRecipesById = new Map(getSafeRecipes([customRecipe('cashew-test', 'Cashew Curry', 'cashew')], excludedIngredients).map((recipe) => [recipe.id, recipe]));
  const plannedRecipeIds = plan.days.flatMap((day) => Object.values(day.meals).map((slot) => slot.recipeId).filter(Boolean));

  assert.ok(plannedRecipeIds.length > 0);
  assert.equal(recipeExcludedAllergens(safeRecipesById.get('strawberry-ricotta-toast'), excludedIngredients).length, 0);
  assert.equal(plannedRecipeIds.includes('cashew-test'), false);
  plannedRecipeIds.forEach((recipeId) => {
    const recipe = safeRecipesById.get(recipeId);
    assert.ok(recipe, `${recipeId} should be in safe recipe pool`);
    assert.deepEqual(recipeExcludedAllergens(recipe, excludedIngredients), []);
  });
});

test('grocery list omits selected allergens and recipes containing them', () => {
  const unsafePistachioRecipe = customRecipe('pistachio-test', 'Pistachio Bowl', 'Pistachios');
  const plan = {
    weekOf: '2026-05-18',
    days: [
      {
        date: '2026-05-18',
        meals: {
          breakfast: { enabled: false },
          brunch: { enabled: false },
          lunch: { enabled: false },
          dinner: { enabled: true, recipeId: 'pistachio-test' }
        }
      }
    ]
  };

  const groceries = buildGroceryList(
    plan,
    {},
    [unsafePistachioRecipe],
    1,
    [{ id: 'staple-cashews', name: 'Cashews', quantity: 1, unit: 'bag', category: 'pantry' }],
    DEFAULT_PREFERENCES.sectionOrder,
    excludedIngredients
  );

  assert.deepEqual(groceries.map((item) => item.name), []);
});

test('bucket plans aggregate safe consumed meals with meal-type serving multipliers and omit unsafe entries', () => {
  const safeLunch = customRecipe('safe-lunch', 'Safe Lunch', 'Rice');
  safeLunch.mealType = ['lunch'];
  const safeDinner = customRecipe('safe-dinner', 'Safe Dinner', 'Rice');
  safeDinner.ingredients[0].quantity = 2;
  const unsafeDinner = customRecipe('unsafe-dinner', 'Unsafe Dinner', 'Pistachios');
  const plan = {
    schemaVersion: 2, id: 'bucket-groceries', createdAt: '2026-05-18T00:00:00.000Z',
    requestedCounts: { breakfast: 0, brunch: 0, lunch: 1, dinner: 2 },
    buckets: {
      breakfast: [], brunch: [],
      lunch: [{ id: 'lunch-1', mealType: 'lunch', recipeId: 'safe-lunch', consumed: true }],
      dinner: [{ id: 'dinner-1', mealType: 'dinner', recipeId: 'safe-dinner' }, { id: 'dinner-2', mealType: 'dinner', unsafeRecipeId: 'unsafe-dinner', unsafeExcludedIngredients: ['Pistachios'] }]
    }
  };

  const groceries = buildGroceryList(plan, {}, [safeLunch, safeDinner, unsafeDinner], { lunch: 2, dinner: 3 }, [], DEFAULT_PREFERENCES.sectionOrder, excludedIngredients);
  assert.deepEqual(groceries.map(({ name, quantity, unit, category }) => ({ name, quantity, unit, category })), [
    { name: 'Rice', quantity: 8, unit: 'cup', category: 'pantry' }
  ]);
});

test('BBQ pulled pork contributes cabbage slaw mix without plain cabbage', () => {
  const plan = {
    weekOf: '2026-06-29',
    days: [
      {
        date: '2026-06-29',
        meals: {
          breakfast: { enabled: false },
          brunch: { enabled: false },
          lunch: { enabled: false },
          dinner: { enabled: true, recipeId: 'bbq-pulled-pork-sandwiches' }
        }
      }
    ]
  };

  const groceries = buildGroceryList(
    plan,
    {},
    [],
    1,
    [],
    DEFAULT_PREFERENCES.sectionOrder,
    excludedIngredients
  );
  const groceryNames = groceries.map((item) => item.name);

  assert.ok(groceryNames.includes('cabbage slaw mix'));
  assert.equal(groceryNames.includes('cabbage'), false);
});

test('unsafe existing plan slots are preserved with allergen metadata instead of silently cleared', () => {
  const unsafePistachioRecipe = customRecipe('pistachio-test', 'Pistachio Bowl', 'Pistachios');
  const plan = {
    weekOf: '2026-05-18',
    days: [
      {
        date: '2026-05-18',
        meals: {
          breakfast: { enabled: false },
          brunch: { enabled: false },
          lunch: { enabled: false },
          dinner: { enabled: true, recipeId: 'pistachio-test' }
        }
      }
    ]
  };

  const nextPlan = syncPlanMealParticipation(
    plan,
    { ...DEFAULT_PREFERENCES, excludedIngredients },
    [unsafePistachioRecipe]
  );
  const dinner = nextPlan.days[0].meals.dinner;

  assert.equal(dinner.enabled, true);
  assert.equal(dinner.recipeId, undefined);
  assert.equal(dinner.unsafeRecipeId, 'pistachio-test');
  assert.deepEqual(dinner.unsafeExcludedIngredients, ['Pistachios']);
});
