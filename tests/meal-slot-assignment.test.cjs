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
const {
  assignRecipeToSlot,
  createPlanFromConfig,
  swapRecipesBetweenSlots,
  isRecipeEligibleForMealType,
  normalizePlan,
  regenerateWeek,
  toggleMealSlotEnabled
} = require(path.join(projectRoot, 'src/lib/meal-generator.ts'));

function createCustomRecipe({ id, mealType, name, description }) {
  return {
    id,
    name,
    description,
    mealType,
    proteins: ['chicken'],
    cuisine: 'Test Kitchen',
    prepTime: 10,
    cookTime: 15,
    servings: 4,
    difficulty: 'easy',
    ingredients: [],
    instructions: ['Test instruction'],
    isCustom: true
  };
}

function createPreferences(overrides = {}) {
  return {
    selectedProteins: ['fish', 'pork', 'red-meat', 'chicken'],
    favoriteProteins: [],
    theme: 'system',
    favoriteRecipeIds: [],
    adults: 2,
    children: 0,
    householdMembers: createHouseholdMembers(2, 0),
    customStaples: [],
    brunchMode: false,
    sectionOrder: [
      'produce',
      'protein',
      'dairy',
      'pantry',
      'spice',
      'bakery',
      'frozen',
      'beverage',
      'household',
      'other'
    ],
    ...overrides
  };
}

test('assignRecipeToSlot updates an enabled slot with a compatible recipe', () => {
  const plan = createPlanFromConfig(createPreferences(), [
    { enabled: true, breakfast: false, lunch: true, dinner: false },
    { enabled: false, breakfast: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, lunch: false, dinner: false }
  ], []);

  const nextPlan = assignRecipeToSlot(plan, 0, 'lunch', 'mediterranean-chicken-pitas', []);

  assert.equal(nextPlan.days[0].meals.lunch.enabled, true);
  assert.equal(nextPlan.days[0].meals.lunch.recipeId, 'mediterranean-chicken-pitas');
});

test('assignRecipeToSlot does not create a disabled slot or allow mismatched meal types', () => {
  const plan = createPlanFromConfig(createPreferences(), [
    { enabled: true, breakfast: false, lunch: true, dinner: false },
    { enabled: false, breakfast: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, lunch: false, dinner: false }
  ], []);

  const disabledResult = assignRecipeToSlot(plan, 0, 'dinner', 'sheet-pan-garlic-salmon', []);
  const mismatchedResult = assignRecipeToSlot(plan, 0, 'lunch', 'strawberry-ricotta-toast', []);

  assert.equal(disabledResult, plan);
  assert.equal(mismatchedResult, plan);
  assert.equal(plan.days[0].meals.dinner.enabled, false);
  assert.notEqual(plan.days[0].meals.lunch.recipeId, 'strawberry-ricotta-toast');
});

test('swapRecipesBetweenSlots swaps compatible enabled slots, including on the same day', () => {
  const customRecipes = [
    createCustomRecipe({
      id: 'custom-versatile-soup',
      mealType: ['lunch', 'dinner'],
      name: 'Versatile Soup',
      description: 'Works for lunch or dinner.'
    }),
    createCustomRecipe({
      id: 'custom-versatile-pasta',
      mealType: ['lunch', 'dinner'],
      name: 'Versatile Pasta',
      description: 'Also works for lunch or dinner.'
    })
  ];
  let plan = createPlanFromConfig(createPreferences(), [
    { enabled: true, breakfast: false, lunch: true, dinner: true },
    { enabled: false, breakfast: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, lunch: false, dinner: false }
  ], customRecipes);

  plan = assignRecipeToSlot(plan, 0, 'lunch', 'custom-versatile-soup', customRecipes);
  plan = assignRecipeToSlot(plan, 0, 'dinner', 'custom-versatile-pasta', customRecipes);

  const swappedPlan = swapRecipesBetweenSlots(
    plan,
    { dayIndex: 0, mealType: 'lunch' },
    { dayIndex: 0, mealType: 'dinner' },
    customRecipes
  );

  assert.equal(swappedPlan.days[0].meals.lunch.recipeId, 'custom-versatile-pasta');
  assert.equal(swappedPlan.days[0].meals.dinner.recipeId, 'custom-versatile-soup');
});

test('swapRecipesBetweenSlots allows cross-type occupied swaps without recipe compatibility checks', () => {
  const customRecipes = [
    createCustomRecipe({
      id: 'custom-breakfast-bites',
      mealType: ['breakfast'],
      name: 'Breakfast Bites',
      description: 'Breakfast only.'
    }),
    createCustomRecipe({
      id: 'custom-lunch-wrap',
      mealType: ['lunch'],
      name: 'Lunch Wrap',
      description: 'Lunch only.'
    })
  ];
  let plan = createPlanFromConfig(createPreferences(), [
    { enabled: true, breakfast: true, lunch: true, dinner: false },
    { enabled: false, breakfast: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, lunch: false, dinner: false }
  ], customRecipes);

  plan = assignRecipeToSlot(plan, 0, 'breakfast', 'custom-breakfast-bites', customRecipes);
  plan = assignRecipeToSlot(plan, 0, 'lunch', 'custom-lunch-wrap', customRecipes);

  const swappedPlan = swapRecipesBetweenSlots(
    plan,
    { dayIndex: 0, mealType: 'breakfast' },
    { dayIndex: 0, mealType: 'lunch' },
    customRecipes
  );

  assert.equal(swappedPlan.days[0].meals.breakfast.recipeId, 'custom-lunch-wrap');
  assert.equal(swappedPlan.days[0].meals.lunch.recipeId, 'custom-breakfast-bites');
});


test('consumed slots persist through normalization and cannot be changed or swapped', () => {
  const customRecipes = [
    createCustomRecipe({ id: 'custom-lunch-wrap', mealType: ['lunch'], name: 'Lunch Wrap', description: 'Lunch.' }),
    createCustomRecipe({ id: 'custom-breakfast-bites', mealType: ['breakfast'], name: 'Breakfast Bites', description: 'Breakfast.' })
  ];
  let plan = createPlanFromConfig(createPreferences(), [
    { enabled: true, breakfast: false, brunch: false, lunch: true, dinner: true },
    { enabled: false, breakfast: false, brunch: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, brunch: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, brunch: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, brunch: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, brunch: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, brunch: false, lunch: false, dinner: false }
  ], customRecipes);
  plan = assignRecipeToSlot(plan, 0, 'lunch', 'custom-lunch-wrap', customRecipes);
  plan = assignRecipeToSlot(plan, 0, 'dinner', 'custom-breakfast-bites', customRecipes);
  plan.days[0].meals.lunch.consumed = true;

  const normalized = normalizePlan(plan, createPreferences());
  assert.equal(normalized.days[0].meals.lunch.consumed, true);
  assert.equal(assignRecipeToSlot(normalized, 0, 'lunch', 'custom-breakfast-bites', customRecipes), normalized);
  assert.equal(
    swapRecipesBetweenSlots(normalized, { dayIndex: 0, mealType: 'lunch' }, { dayIndex: 0, mealType: 'dinner' }, customRecipes),
    normalized
  );
});

test('regenerateWeek preserves consumed slots and keeps them unavailable for reassignment', () => {
  const customRecipes = [
    createCustomRecipe({ id: 'custom-lunch-wrap', mealType: ['lunch'], name: 'Lunch Wrap', description: 'Lunch.' })
  ];
  let plan = createPlanFromConfig(createPreferences({ favoriteRecipeIds: ['custom-lunch-wrap'] }), [
    { enabled: true, breakfast: false, brunch: false, lunch: true, dinner: true },
    { enabled: true, breakfast: false, brunch: false, lunch: true, dinner: false },
    { enabled: false, breakfast: false, brunch: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, brunch: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, brunch: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, brunch: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, brunch: false, lunch: false, dinner: false }
  ], customRecipes);
  plan = assignRecipeToSlot(plan, 0, 'lunch', 'custom-lunch-wrap', customRecipes);
  plan.days[0].meals.lunch.consumed = true;

  const regenerated = regenerateWeek(plan, createPreferences({ favoriteRecipeIds: ['custom-lunch-wrap'] }), customRecipes);

  assert.notEqual(regenerated, plan);
  assert.deepEqual(regenerated.days[0].meals.lunch, {
    enabled: true,
    recipeId: 'custom-lunch-wrap',
    consumed: true
  });
  assert.notEqual(regenerated.days[1].meals.lunch.recipeId, 'custom-lunch-wrap');
});

test('toggleMealSlotEnabled refuses to disable consumed slots', () => {
  const customRecipes = [
    createCustomRecipe({ id: 'custom-lunch-wrap', mealType: ['lunch'], name: 'Lunch Wrap', description: 'Lunch.' })
  ];
  let plan = createPlanFromConfig(createPreferences(), [
    { enabled: true, breakfast: false, brunch: false, lunch: true, dinner: false },
    { enabled: false, breakfast: false, brunch: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, brunch: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, brunch: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, brunch: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, brunch: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, brunch: false, lunch: false, dinner: false }
  ], customRecipes);
  plan = assignRecipeToSlot(plan, 0, 'lunch', 'custom-lunch-wrap', customRecipes);
  plan.days[0].meals.lunch.consumed = true;

  const toggled = toggleMealSlotEnabled(plan, 0, 'lunch', createPreferences(), customRecipes);

  assert.equal(toggled, plan);
  assert.equal(toggled.days[0].meals.lunch.enabled, true);
  assert.equal(toggled.days[0].meals.lunch.recipeId, 'custom-lunch-wrap');
  assert.equal(toggled.days[0].meals.lunch.consumed, true);
});

test('toggleMealSlotEnabled still disables unconsumed slots', () => {
  const customRecipes = [
    createCustomRecipe({ id: 'custom-lunch-wrap', mealType: ['lunch'], name: 'Lunch Wrap', description: 'Lunch.' })
  ];
  let plan = createPlanFromConfig(createPreferences(), [
    { enabled: true, breakfast: false, brunch: false, lunch: true, dinner: false },
    { enabled: false, breakfast: false, brunch: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, brunch: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, brunch: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, brunch: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, brunch: false, lunch: false, dinner: false },
    { enabled: false, breakfast: false, brunch: false, lunch: false, dinner: false }
  ], customRecipes);
  plan = assignRecipeToSlot(plan, 0, 'lunch', 'custom-lunch-wrap', customRecipes);

  const toggled = toggleMealSlotEnabled(plan, 0, 'lunch', createPreferences(), customRecipes);

  assert.notEqual(toggled, plan);
  assert.equal(toggled.days[0].meals.lunch.enabled, false);
  assert.equal(toggled.days[0].meals.lunch.recipeId, undefined);
  assert.equal(toggled.days[0].meals.lunch.consumed, undefined);
});

test('swapRecipesBetweenSlots moves a source meal into an empty enabled slot', () => {
  const customRecipes = [
    createCustomRecipe({ id: 'custom-lunch-wrap', mealType: ['lunch'], name: 'Lunch Wrap', description: 'Lunch.' })
  ];
  const plan = {
    weekOf: '2026-04-27',
    days: [{
      date: '2026-04-27',
      meals: {
        breakfast: { enabled: true },
        brunch: { enabled: false },
        lunch: { enabled: true, recipeId: 'custom-lunch-wrap' },
        dinner: { enabled: false }
      }
    }]
  };

  const moved = swapRecipesBetweenSlots(plan, { dayIndex: 0, mealType: 'lunch' }, { dayIndex: 0, mealType: 'breakfast' }, customRecipes);

  assert.equal(moved.days[0].meals.breakfast.recipeId, 'custom-lunch-wrap');
  assert.equal(moved.days[0].meals.lunch.recipeId, undefined);
});

test('brunch mode generates brunch and dinner only while preserving standard mode', () => {
  const standard = createPlanFromConfig(createPreferences(), undefined, []);
  assert.ok(standard.days.every((day) => day.meals.breakfast.enabled && day.meals.lunch.enabled && day.meals.dinner.enabled));
  assert.ok(standard.days.every((day) => day.meals.brunch.enabled === false));

  const brunchPlan = createPlanFromConfig(createPreferences({ brunchMode: true }), undefined, []);
  assert.ok(brunchPlan.days.every((day) => day.meals.breakfast.enabled === false));
  assert.ok(brunchPlan.days.every((day) => day.meals.lunch.enabled === false));
  assert.ok(brunchPlan.days.every((day) => day.meals.brunch.enabled && day.meals.dinner.enabled));
});

test('brunch is eligible for brunch, breakfast, and lunch recipes while change meal context stays filtered', () => {
  assert.equal(isRecipeEligibleForMealType(createCustomRecipe({ id: 'custom-brunch', mealType: ['brunch'], name: 'Brunch', description: 'Brunch.' }), 'brunch'), true);
  assert.equal(isRecipeEligibleForMealType(createCustomRecipe({ id: 'custom-breakfast', mealType: ['breakfast'], name: 'Breakfast', description: 'Breakfast.' }), 'brunch'), true);
  assert.equal(isRecipeEligibleForMealType(createCustomRecipe({ id: 'custom-lunch', mealType: ['lunch'], name: 'Lunch', description: 'Lunch.' }), 'brunch'), true);
  assert.equal(isRecipeEligibleForMealType(createCustomRecipe({ id: 'custom-dinner', mealType: ['dinner'], name: 'Dinner', description: 'Dinner.' }), 'brunch'), false);
  assert.equal(isRecipeEligibleForMealType(createCustomRecipe({ id: 'custom-brunch-only', mealType: ['brunch'], name: 'Brunch Only', description: 'Brunch.' }), 'dinner'), false);
});
