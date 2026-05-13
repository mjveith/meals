const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), 'utf8'));
}

function asSearchText(value) {
  return JSON.stringify(value).toLowerCase();
}

test('recipe archive honors household lettuce and herb preferences', () => {
  const recipes = readJson('src/data/recipes.json');
  const searchText = asSearchText(recipes);

  assert.equal(searchText.includes('romaine'), false);
  assert.equal(searchText.includes('parsley'), false);

  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  assert.equal(
    byId.get('mediterranean-chicken-pitas').ingredients.some((ingredient) => ingredient.name === 'arugula'),
    true
  );
  assert.equal(
    byId.get('steakhouse-salad').ingredients.some((ingredient) => ingredient.name === 'arugula'),
    true
  );
  assert.equal(
    byId.get('salmon-caesar-wraps').ingredients.some((ingredient) => ingredient.name === 'butter lettuce'),
    true
  );
  assert.equal(
    byId.get('southwest-chicken-chopped-salad').ingredients.some((ingredient) => ingredient.name === 'butter lettuce'),
    true
  );
});

test('Beef Kofta Rice Plates uses cilantro instead of parsley everywhere', () => {
  const recipes = readJson('src/data/recipes.json');
  const kofta = recipes.find((recipe) => recipe.id === 'beef-kofta-rice-plates');

  assert.ok(kofta, 'expected Beef Kofta Rice Plates to exist in the recipe archive');
  assert.equal(asSearchText(kofta).includes('parsley'), false);
  assert.equal(
    kofta.ingredients.some((ingredient) => ingredient.name === 'cilantro'),
    true
  );
  assert.equal(kofta.instructions.some((step) => step.toLowerCase().includes('cilantro')), true);
});

function assertNoRetiredTerms(label, value) {
  const searchText = asSearchText(value);

  assert.equal(searchText.includes('romaine'), false, `${label} should not include retired romaine text`);
  assert.equal(searchText.includes('parsley'), false, `${label} should not include retired parsley text`);
}

test('tracked UI-fed meal state has no retired romaine or parsley terms', () => {
  const stateFiles = [
    ['app meals-state.json', path.resolve(projectRoot, 'meals-state.json')],
    ['shared meals-state.json', path.resolve(projectRoot, '../shared-state/meals-state.json')],
    ['shared meals-state.backup.json', path.resolve(projectRoot, '../shared-state/meals-state.backup.json')]
  ];

  for (const [label, filePath] of stateFiles) {
    const state = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assertNoRetiredTerms(label, {
      mealPlan: state.mealPlan,
      savedWeeks: state.savedWeeks,
      groceryOverrides: state.groceryOverrides,
      customGroceryItems: state.customGroceryItems,
      customRecipes: state.customRecipes
    });
  }
});
