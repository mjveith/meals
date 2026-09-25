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

const { DEFAULT_PREFERENCES, PROTEIN_OPTIONS } = require(path.join(projectRoot, 'src/lib/constants.ts'));
const { sanitizeState } = require(path.join(projectRoot, 'src/lib/state-store.ts'));

test('Duck is a selectable default protein and survives persisted-state normalization', () => {
  assert.deepEqual(PROTEIN_OPTIONS.find((protein) => protein.id === 'duck'), { id: 'duck', label: 'Duck' });
  assert.ok(DEFAULT_PREFERENCES.selectedProteins.includes('duck'));

  const sanitized = sanitizeState({
    preferences: {
      ...DEFAULT_PREFERENCES,
      selectedProteins: ['duck'],
      favoriteProteins: ['duck']
    }
  });

  assert.deepEqual(sanitized.preferences.selectedProteins, ['duck']);
  assert.deepEqual(sanitized.preferences.favoriteProteins, ['duck']);
});

test('The recipe catalog includes a varied Duck collection and the requested beef stew', () => {
  const recipes = require(path.join(projectRoot, 'src/data/recipes.json'));
  const duckRecipes = recipes.filter((recipe) => recipe.proteins.includes('duck'));

  assert.ok(duckRecipes.length >= 5, 'expected at least five Duck recipes');
  assert.ok(duckRecipes.every((recipe) => recipe.mealType.some((mealType) => mealType === 'lunch' || mealType === 'dinner')));
  assert.ok(duckRecipes.every((recipe) => recipe.ingredients.some((ingredient) => ingredient.category === 'protein' && ingredient.name.toLowerCase().includes('duck'))));

  for (const recipeId of ['shredded-duck-tacos-citrus-slaw', 'duck-mushroom-ragu-pappardelle']) {
    const recipe = recipes.find((candidate) => candidate.id === recipeId);
    const ingredientNames = new Set(recipe.ingredients.map((ingredient) => ingredient.name.toLowerCase()));
    assert.ok(ingredientNames.has('salt'), `expected ${recipeId} to include instructed salt in the grocery list`);
    assert.ok(ingredientNames.has('black pepper'), `expected ${recipeId} to include instructed black pepper in the grocery list`);
  }

  const stew = recipes.find((recipe) => recipe.id === 'classic-beef-stew');
  assert.ok(stew, 'expected Classic Beef Stew in the catalog');
  assert.deepEqual(stew.proteins, ['red-meat']);
  assert.ok(stew.mealType.includes('dinner'));

  const ingredientNames = new Set(stew.ingredients.map((ingredient) => ingredient.name.toLowerCase()));
  for (const ingredient of [
    'beef chuck',
    'tomato paste',
    'onion',
    'baby potatoes',
    'carrot',
    'celery',
    'apple cider vinegar',
    'beef bone broth',
    'garlic',
    'salt',
    'black pepper',
    'thyme',
    'rosemary',
    'bay leaf',
    'smoked paprika'
  ]) {
    assert.ok(ingredientNames.has(ingredient), `expected beef stew ingredient: ${ingredient}`);
  }
});
