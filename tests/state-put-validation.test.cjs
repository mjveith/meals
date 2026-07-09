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

const {
  PUT,
  normalizeSharedStatePatch,
  parsePutStateRequest,
  maxPutBodyBytes
} = require(path.join(projectRoot, 'src/app/api/state/route.ts'));

test('normalizeSharedStatePatch drops invalid customRecipes and preserves valid normalized recipes', () => {
  const patch = normalizeSharedStatePatch({
    customRecipes: [
      { id: 'not-custom', name: 'Bad id', mealType: ['dinner'], ingredients: [] },
      { id: 'custom-empty-name', name: '   ', mealType: ['dinner'], ingredients: [] },
      {
        id: 'custom-good',
        name: '  Good Soup  ',
        description: 42,
        mealType: ['dinner', 'snack', 'lunch'],
        proteins: ['chicken', 'tofu'],
        cuisine: '  Cozy  ',
        prepTime: 10,
        cookTime: '20',
        servings: 4,
        difficulty: 'hard',
        ingredients: [
          { name: '  Carrot ', quantity: '2', unit: ' cups ', category: 'produce' },
          { name: '', quantity: 1, unit: 'lb', category: 'protein' },
          { name: 'Salt', quantity: Number.POSITIVE_INFINITY, unit: 'tsp', category: 'spice' }
        ],
        instructions: [' Chop ', 9, 'Simmer']
      }
    ]
  });

  assert.equal(patch.customRecipes.length, 1);
  assert.deepEqual(patch.customRecipes[0], {
    id: 'custom-good',
    isCustom: true,
    name: 'Good Soup',
    description: '',
    mealType: ['dinner', 'lunch'],
    proteins: ['chicken'],
    cuisine: 'Cozy',
    prepTime: 10,
    cookTime: 20,
    servings: 4,
    difficulty: 'easy',
    ingredients: [{ name: 'Carrot', quantity: 2, unit: 'cups', category: 'produce' }],
    instructions: ['Chop', 'Simmer']
  });
});

test('normalizeSharedStatePatch strips invalid groceryOverrides entries and fields', () => {
  const patch = normalizeSharedStatePatch({
    groceryOverrides: {
      milk: { adjustment: 2, collected: true, extra: 'drop' },
      eggs: { adjustment: Number.NaN, collected: false },
      bread: { collected: 'yes' },
      apples: { adjustment: -1 }
    }
  });

  assert.deepEqual(patch.groceryOverrides, {
    milk: { adjustment: 2, collected: true },
    eggs: { adjustment: 0, collected: false },
    apples: { adjustment: -1, collected: false }
  });
});

test('parsePutStateRequest returns 400 for malformed JSON', async () => {
  const result = await parsePutStateRequest(new Request('http://local/api/state', {
    method: 'PUT',
    body: '{bad json',
    headers: { 'content-type': 'application/json' }
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 400);
  assert.deepEqual(result.body, { error: 'invalid JSON' });
});

test('parsePutStateRequest returns 413 for oversized bodies', async () => {
  const result = await parsePutStateRequest(new Request('http://local/api/state', {
    method: 'PUT',
    body: JSON.stringify({ padding: 'x'.repeat(maxPutBodyBytes) }),
    headers: { 'content-type': 'application/json' }
  }));

  assert.equal(result.ok, false);
  assert.equal(result.status, 413);
  assert.deepEqual(result.body, { error: 'request body too large' });
});

test('PUT returns 400 for malformed JSON before touching state', async () => {
  const response = await PUT(new Request('http://local/api/state', {
    method: 'PUT',
    body: '{bad json',
    headers: { 'content-type': 'application/json' }
  }));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'invalid JSON' });
});
