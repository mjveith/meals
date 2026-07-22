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

test('runtime meal-state files remain excluded from the repository', () => {
  const ignoredPaths = new Set(
    fs.readFileSync(path.join(projectRoot, '.gitignore'), 'utf8')
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean)
  );

  assert.equal(ignoredPaths.has('meals-state.json'), true);
  assert.equal(ignoredPaths.has('meals-state.backup.json'), true);
  assert.equal(ignoredPaths.has('meals-state-history/'), true);
});
