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

test('tracked saved meal state has no retired romaine or parsley grocery terms', () => {
  const state = readJson('meals-state.json');
  const searchText = asSearchText({
    groceryOverrides: state.groceryOverrides,
    savedWeeks: state.savedWeeks
  });

  assert.equal(searchText.includes('romaine'), false);
  assert.equal(searchText.includes('parsley'), false);
});
