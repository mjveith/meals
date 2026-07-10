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

const {
  SAVED_WEEKS_PAGE_SIZE,
  buildRecipeArchiveSearchText,
  getVisibleSavedWeeks,
  searchRecipeArchive
} = require(path.join(projectRoot, 'src/lib/saved-archive.ts'));
const { toggleFavoriteRecipeIds } = require(path.join(projectRoot, 'src/lib/favorites.ts'));

function createRecipe(overrides = {}) {
  return {
    id: 'sample',
    name: 'Sample Recipe',
    description: 'Test description',
    mealType: ['dinner'],
    proteins: [],
    cuisine: 'American',
    prepTime: 10,
    cookTime: 15,
    servings: 4,
    difficulty: 'easy',
    ingredients: [{ name: 'salt', quantity: 1, unit: 'tsp', category: 'spice' }],
    instructions: ['Cook it.'],
    ...overrides
  };
}

test('getVisibleSavedWeeks defaults to the first five saved weeks and expands cleanly', () => {
  const savedWeeks = Array.from({ length: 12 }, (_, index) => ({ id: `week-${index}` }));

  assert.equal(SAVED_WEEKS_PAGE_SIZE, 5);
  assert.deepEqual(
    getVisibleSavedWeeks(savedWeeks).map((week) => week.id),
    ['week-0', 'week-1', 'week-2', 'week-3', 'week-4']
  );
  assert.deepEqual(
    getVisibleSavedWeeks(savedWeeks, 10).map((week) => week.id),
    ['week-0', 'week-1', 'week-2', 'week-3', 'week-4', 'week-5', 'week-6', 'week-7', 'week-8', 'week-9']
  );
});

test('buildRecipeArchiveSearchText includes proteins, cuisine, and ingredients', () => {
  const recipe = createRecipe({
    name: 'Maple Dijon Pork Chops',
    proteins: ['pork'],
    cuisine: 'American',
    ingredients: [{ name: 'carrots', quantity: 1, unit: 'lb', category: 'produce' }]
  });

  const searchText = buildRecipeArchiveSearchText(recipe);
  assert.match(searchText, /pork/);
  assert.match(searchText, /american/);
  assert.match(searchText, /carrots/);
});

test('searchRecipeArchive ranks exact recipe names first and supports ingredient token matches', () => {
  const recipes = [
    createRecipe({
      id: 'salmon-bowls',
      name: 'Pesto Salmon Couscous Bowls',
      proteins: ['fish'],
      cuisine: 'Mediterranean',
      ingredients: [{ name: 'couscous', quantity: 1.5, unit: 'cup', category: 'pantry' }]
    }),
    createRecipe({
      id: 'pork-chops',
      name: 'Maple Dijon Pork Chops',
      proteins: ['pork'],
      cuisine: 'American',
      ingredients: [{ name: 'carrots', quantity: 1, unit: 'lb', category: 'produce' }]
    }),
    createRecipe({
      id: 'salad',
      name: 'Garden Salad',
      proteins: [],
      cuisine: 'American',
      ingredients: [{ name: 'cucumber', quantity: 1, unit: 'count', category: 'produce' }]
    })
  ];

  assert.deepEqual(searchRecipeArchive(recipes, '').map((recipe) => recipe.id), [
    'salad',
    'pork-chops',
    'salmon-bowls'
  ]);
  assert.equal(searchRecipeArchive(recipes, 'Maple Dijon Pork Chops')[0].id, 'pork-chops');
  const ingredientMatches = searchRecipeArchive(recipes, 'cucumber american').map((recipe) => recipe.id);
  assert.equal(ingredientMatches[0], 'salad');
  assert.ok(ingredientMatches.includes('salad'));
});

test('toggleFavoriteRecipeIds persists archive favorite changes without duplicates', () => {
  assert.deepEqual(toggleFavoriteRecipeIds(['salad'], 'pork-chops'), ['salad', 'pork-chops']);
  assert.deepEqual(toggleFavoriteRecipeIds(['salad', 'pork-chops'], 'pork-chops'), ['salad']);
  assert.deepEqual(toggleFavoriteRecipeIds(['salad', 'salad'], 'pork-chops'), ['salad', 'pork-chops']);
});
