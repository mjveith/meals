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

const { DEFAULT_PREFERENCES } = require(path.join(projectRoot, 'src/lib/constants.ts'));
const { buildGroceryList } = require(path.join(projectRoot, 'src/lib/grocery-builder.ts'));
const {
  createHouseholdMembers,
  getMealServingMultipliers,
} = require(path.join(projectRoot, 'src/lib/household.ts'));
const { createPlanFromConfig } = require(path.join(projectRoot, 'src/lib/meal-generator.ts'));

function makePreferences(overrides = {}) {
  return {
    ...DEFAULT_PREFERENCES,
    ...overrides,
  };
}

test('default household members match the expected breakfast participation', () => {
  const members = createHouseholdMembers(2, 1);

  assert.deepEqual(
    members.map((member) => ({
      name: member.name,
      kind: member.kind,
      meals: member.mealParticipation,
    })),
    [
      { name: 'Paesano', kind: 'adult', meals: ['brunch', 'lunch', 'dinner'] },
      { name: 'Young', kind: 'adult', meals: ['breakfast', 'brunch', 'lunch', 'dinner'] },
      { name: 'Ronin', kind: 'child', meals: ['breakfast', 'brunch', 'lunch', 'dinner'] },
    ]
  );
});

test('meal plan generation disables meal types with no participating household members', () => {
  const householdMembers = createHouseholdMembers(2, 1).map((member) => ({
    ...member,
    mealParticipation: member.mealParticipation.filter((mealType) => mealType !== 'breakfast'),
  }));
  const plan = createPlanFromConfig(
    makePreferences({ householdMembers, adults: 2, children: 1 }),
    Array.from({ length: 7 }, () => ({ enabled: true, breakfast: true, lunch: true, dinner: true })),
    []
  );

  assert.equal(plan.days.length, 7);
  assert.ok(plan.days.every((day) => day.meals.breakfast.enabled === false));
  assert.ok(plan.days.every((day) => day.meals.lunch.enabled === true));
  assert.ok(plan.days.every((day) => day.meals.dinner.enabled === true));
});

test('grocery quantities scale by the people who actually eat each meal type', () => {
  const householdMembers = createHouseholdMembers(2, 1);
  const mealServingMultipliers = getMealServingMultipliers(householdMembers);
  const customRecipes = [
    {
      id: 'custom-breakfast-oats',
      isCustom: true,
      name: 'Breakfast Oats',
      description: 'Simple oats',
      mealType: ['breakfast'],
      proteins: [],
      cuisine: 'American',
      prepTime: 5,
      cookTime: 5,
      servings: 4,
      ingredients: [
        { name: 'eggs', quantity: 4, unit: 'count', category: 'dairy' },
      ],
      instructions: ['Cook it'],
    },
    {
      id: 'custom-lunch-bowls',
      isCustom: true,
      name: 'Lunch Bowls',
      description: 'Simple bowls',
      mealType: ['lunch'],
      proteins: ['chicken'],
      cuisine: 'American',
      prepTime: 10,
      cookTime: 10,
      servings: 4,
      ingredients: [
        { name: 'chicken breast', quantity: 2, unit: 'lb', category: 'protein' },
      ],
      instructions: ['Cook it'],
    },
  ];
  const plan = {
    weekOf: '2026-04-13',
    days: [
      {
        date: '2026-04-13',
        meals: {
          breakfast: { enabled: true, recipeId: 'custom-breakfast-oats' },
          lunch: { enabled: true, recipeId: 'custom-lunch-bowls' },
          dinner: { enabled: false },
        },
      },
    ],
  };

  const groceries = buildGroceryList(plan, {}, customRecipes, mealServingMultipliers, [], DEFAULT_PREFERENCES.sectionOrder);

  assert.equal(mealServingMultipliers.breakfast, 0.375);
  assert.equal(mealServingMultipliers.lunch, 0.625);
  assert.equal(
    groceries.find((item) => item.name === 'eggs').quantity,
    1.5
  );
  assert.equal(
    groceries.find((item) => item.name === 'chicken breast').quantity,
    1.25
  );
});
