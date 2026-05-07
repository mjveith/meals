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
        esModuleInterop: true
      },
      fileName: filename
    });

    module._compile(output.outputText, filename);
  };
}

const { storage } = require(path.join(projectRoot, 'src/lib/storage.ts'));
const {
  collectLegacyCustomStaples,
  customStapleListsEqual,
  mergeCustomStaples,
  migrateLegacyCustomStaplesToSharedState
} = require(path.join(projectRoot, 'src/lib/custom-staples.ts'));

function createLocalStorage(seed = {}) {
  const data = new Map(Object.entries(seed));

  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    key(index) {
      return [...data.keys()][index] ?? null;
    },
    get length() {
      return data.size;
    }
  };
}

function createSharedStateResponse(customStaples = [], version = 7) {
  return {
    version,
    preferences: {
      selectedProteins: [],
      favoriteProteins: [],
      favoriteRecipeIds: [],
      adults: 2,
      children: 0,
      householdMembers: [],
      customStaples,
      sectionOrder: ['produce', 'protein', 'dairy', 'grains', 'canned', 'frozen', 'spice', 'bakery', 'other']
    },
    mealPlan: null,
    groceryOverrides: {},
    customGroceryItems: [],
    customRecipes: [],
    savedWeeks: []
  };
}

test('storage loads, normalizes, and dedupes legacy custom staples from meals.* payloads', () => {
  global.window = {
    localStorage: createLocalStorage({
      'meals.preferences': JSON.stringify({
        customStaples: [
          { name: ' Rice ', quantity: '2', unit: 'cups', category: 'pantry' },
          { name: 'Salt', quantity: 1, unit: 'tbsp', category: 'staples' }
        ]
      }),
      'meals.cached-state': JSON.stringify({
        preferences: {
          customStaples: [
            { name: 'rice', quantity: 2, unit: 'cups', category: 'pantry' },
            { name: 'Pepper', quantity: 1, unit: 'tsp', category: 'spice' }
          ]
        }
      }),
      'meals.theme': JSON.stringify('dark')
    })
  };

  const legacyStaples = storage.loadLegacyCustomStaples();

  assert.equal(legacyStaples.length, 3);
  assert.deepEqual(
    legacyStaples.map((staple) => [staple.name, staple.quantity, staple.unit, staple.category]),
    [
      ['Rice', 2, 'cups', 'pantry'],
      ['Salt', 1, 'tbsp', 'other'],
      ['Pepper', 1, 'tsp', 'spice']
    ]
  );
});

test('mergeCustomStaples avoids duplicates already present in shared state', () => {
  const merged = mergeCustomStaples(
    [{ name: 'Pepper', quantity: 1, unit: 'tsp', category: 'spice' }],
    [
      { name: 'pepper', quantity: 1, unit: 'tsp', category: 'spice' },
      { name: 'Beans', quantity: 2, unit: 'can', category: 'pantry' }
    ]
  );

  assert.equal(merged.length, 2);
  assert.ok(customStapleListsEqual(merged, [...merged].reverse()));
});

test('collectLegacyCustomStaples finds nested legacy payload shapes', () => {
  const legacyStaples = collectLegacyCustomStaples([
    {
      appState: {
        customStaples: [{ name: 'Beans', quantity: 1, unit: 'can', category: 'pantry' }]
      }
    },
    {
      data: {
        customStaples: [{ name: 'Beans', quantity: 1, unit: 'can', category: 'pantry' }]
      }
    }
  ]);

  assert.equal(legacyStaples.length, 1);
  assert.deepEqual(legacyStaples[0], {
    name: 'Beans',
    quantity: 1,
    unit: 'can',
    category: 'pantry'
  });
});

test('migrateLegacyCustomStaplesToSharedState pushes deduped legacy staples into shared state once', async () => {
  const initialState = createSharedStateResponse([
    { name: 'Beans', quantity: 1, unit: 'can', category: 'pantry' }
  ]);
  const pushedPatches = [];
  let markedComplete = 0;

  const result = await migrateLegacyCustomStaplesToSharedState(initialState, 'etag-1', {
    hasMigrationCompleted: () => false,
    loadLegacyCustomStaples: () => [
      { name: 'beans', quantity: 1, unit: 'can', category: 'pantry' },
      { name: 'Rice', quantity: 2, unit: 'cups', category: 'pantry' }
    ],
    markMigrationComplete: () => {
      markedComplete += 1;
    },
    pushSharedState: async (patch) => {
      pushedPatches.push(patch);
      return {
        etag: 'etag-2',
        state: createSharedStateResponse(patch.preferences.customStaples, 8)
      };
    }
  });

  assert.equal(pushedPatches.length, 1);
  assert.deepEqual(
    pushedPatches[0].preferences.customStaples,
    [
      { name: 'Beans', quantity: 1, unit: 'can', category: 'pantry' },
      { name: 'Rice', quantity: 2, unit: 'cups', category: 'pantry' }
    ]
  );
  assert.equal(markedComplete, 1);
  assert.equal(result.version, 8);
  assert.equal(result.etag, 'etag-2');
  assert.equal(result.syncError, null);
  assert.deepEqual(result.state.preferences.customStaples, pushedPatches[0].preferences.customStaples);
});

test('migrateLegacyCustomStaplesToSharedState avoids duplicate pushes when shared state already contains the legacy staples', async () => {
  const initialState = createSharedStateResponse([
    { name: 'Beans', quantity: 1, unit: 'can', category: 'pantry' }
  ]);
  let pushCount = 0;
  let markedComplete = 0;

  const result = await migrateLegacyCustomStaplesToSharedState(initialState, 'etag-1', {
    hasMigrationCompleted: () => false,
    loadLegacyCustomStaples: () => [
      { name: 'beans', quantity: 1, unit: 'can', category: 'pantry' }
    ],
    markMigrationComplete: () => {
      markedComplete += 1;
    },
    pushSharedState: async () => {
      pushCount += 1;
      throw new Error('pushSharedState should not be called for duplicates');
    }
  });

  assert.equal(pushCount, 0);
  assert.equal(markedComplete, 1);
  assert.equal(result.version, 7);
  assert.equal(result.etag, 'etag-1');
  assert.equal(result.syncError, null);
  assert.deepEqual(result.state.preferences.customStaples, initialState.preferences.customStaples);
});
