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
  getArchivedMealCount,
  getArchivedMealSlot,
  getEnabledArchivedMealTypes,
  normalizeArchivedSavedWeek
} = require(path.join(projectRoot, 'src/lib/saved-week.ts'));

test('legacy saved weeks without brunch renderable meal counts instead of throwing', () => {
  const legacyDay = {
    date: '2026-04-27',
    meals: {
      breakfast: { enabled: true, recipeId: 'breakfast-1' },
      lunch: { enabled: false },
      dinner: { enabled: true, recipeId: 'dinner-1' }
    }
  };
  const savedWeek = {
    id: 'legacy-week',
    savedAt: '2026-04-27T12:00:00.000Z',
    weekOf: '2026-04-27',
    label: 'Week of Apr 27',
    mealPlan: { weekOf: '2026-04-27', days: [legacyDay] },
    groceryList: [],
    customGroceryItems: []
  };

  assert.deepEqual(getEnabledArchivedMealTypes(legacyDay), ['breakfast', 'dinner']);
  assert.equal(getArchivedMealSlot(legacyDay, 'brunch').enabled, false);
  assert.equal(getArchivedMealCount(savedWeek), 2);
});

test('legacy saved week normalization fills missing brunch slots while preserving legacy meals', () => {
  const normalized = normalizeArchivedSavedWeek({
    id: 'legacy-week',
    savedAt: '2026-04-27T12:00:00.000Z',
    weekOf: '2026-04-27',
    label: 'Week of Apr 27',
    mealPlan: {
      weekOf: '2026-04-27',
      days: [
        {
          date: '2026-04-27',
          meals: {
            breakfast: { enabled: true, recipeId: 'breakfast-1', consumed: true },
            lunch: { enabled: false },
            dinner: { enabled: true, recipeId: 'dinner-1' }
          }
        }
      ]
    },
    groceryList: [],
    customGroceryItems: []
  });

  assert.deepEqual(Object.keys(normalized.mealPlan.days[0].meals), [
    'breakfast',
    'brunch',
    'lunch',
    'dinner'
  ]);
  assert.deepEqual(normalized.mealPlan.days[0].meals.brunch, { enabled: false });
  assert.deepEqual(normalized.mealPlan.days[0].meals.breakfast, {
    enabled: true,
    recipeId: 'breakfast-1',
    consumed: true
  });
});
