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
  createPlanFromConfig,
  getRecipeMap,
  recipes
} = require(path.join(projectRoot, 'src/lib/meal-generator.ts'));

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

function createDinnerOnlyConfig() {
  return Array.from({ length: 7 }, () => ({
    enabled: true,
    breakfast: false,
    lunch: false,
    dinner: true
  }));
}

function getRecipeText(recipe) {
  return [recipe.name, recipe.description, ...recipe.ingredients.map((ingredient) => ingredient.name)]
    .join(' ')
    .toLowerCase();
}

function isFreshFish(recipe) {
  const text = getRecipeText(recipe);
  return recipe.proteins.includes('fish')
    && /(salmon|cod|trout|halibut|snapper|tilapia|mahi|sea bass|branzino|white fish|fish fillet|fish filet)/.test(text)
    && !/(tuna|shrimp|chowder)/.test(text);
}

function isLateFriendly(recipe) {
  return recipe.proteins.includes('chicken') || /(ground|bacon|meatball|bolognese|sausage)/.test(getRecipeText(recipe));
}

function isFreshButcher(recipe) {
  const text = getRecipeText(recipe);
  return !isLateFriendly(recipe)
    && /(steak|sirloin|flank|ribeye|pork chop|pork tenderloin|tenderloin|cutlet|schnitzel|medallion)/.test(text);
}

test('recipe library was expanded with additional breakfast and protein-forward meals', () => {
  assert.ok(recipes.length > 62, `expected more than 62 recipes, found ${recipes.length}`);

  const recipeIds = new Set(recipes.map((recipe) => recipe.id));

  [
    'strawberry-ricotta-toast',
    'lemon-dill-cod-packets',
    'chimichurri-steak-grain-bowls',
    'rosemary-pork-tenderloin-skillet',
    'chicken-bacon-ranch-pasta'
  ].forEach((recipeId) => {
    assert.ok(recipeIds.has(recipeId), `expected expanded library to include ${recipeId}`);
  });
});

test('first lunch or dinner slot prefers a fresh fish recipe when fish is in rotation', () => {
  const plan = createPlanFromConfig(createPreferences(), createDinnerOnlyConfig(), []);
  const recipeMap = getRecipeMap([]);
  const firstDinner = recipeMap.get(plan.days[0].meals.dinner.recipeId);

  assert.ok(firstDinner, 'expected first dinner recipe to be assigned');
  assert.ok(isFreshFish(firstDinner), `expected first dinner to be fresh fish, got ${firstDinner.name}`);
});

test('fresh butcher proteins get scheduled before late-friendly proteins when fish is absent', () => {
  const plan = createPlanFromConfig(
    createPreferences({ selectedProteins: ['red-meat', 'pork', 'chicken'] }),
    createDinnerOnlyConfig(),
    []
  );
  const recipeMap = getRecipeMap([]);
  const dinnerRecipes = plan.days.map((day) => recipeMap.get(day.meals.dinner.recipeId));

  const firstButcherIndex = dinnerRecipes.findIndex((recipe) => recipe && isFreshButcher(recipe));
  const firstLateFriendlyIndex = dinnerRecipes.findIndex((recipe) => recipe && isLateFriendly(recipe));

  assert.notEqual(firstButcherIndex, -1, 'expected at least one fresh butcher recipe in the week');
  assert.notEqual(firstLateFriendlyIndex, -1, 'expected at least one late-friendly recipe in the week');
  assert.ok(
    firstButcherIndex < firstLateFriendlyIndex,
    `expected a fresh butcher recipe before late-friendly proteins, got ${dinnerRecipes.map((recipe) => recipe.name).join(' -> ')}`
  );
});

test('favorite recipes still get placed while freshness rules guide the remaining week', () => {
  const favoriteRecipeId = 'chicken-bacon-ranch-pasta';
  const plan = createPlanFromConfig(
    createPreferences({ favoriteRecipeIds: [favoriteRecipeId] }),
    createDinnerOnlyConfig(),
    []
  );
  const recipeMap = getRecipeMap([]);
  const dinnerIds = plan.days.map((day) => day.meals.dinner.recipeId);
  const firstDinner = recipeMap.get(dinnerIds[0]);

  assert.ok(dinnerIds.includes(favoriteRecipeId), 'expected favorite recipe to be placed in the week');
  assert.ok(firstDinner && isFreshFish(firstDinner), 'expected freshness heuristic to still lead with fish');
});
