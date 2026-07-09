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

const { mergeStatePatch } = require(path.join(projectRoot, 'src/app/api/state/route.ts'));

function createState(overrides = {}) {
  return {
    preferences: {
      selectedProteins: ['chicken'],
      favoriteProteins: [],
      favoriteRecipeIds: [],
      adults: 2,
      children: 0,
      householdMembers: [],
      customStaples: [],
      sectionOrder: ['produce', 'meat', 'dairy', 'pantry', 'frozen', 'bakery', 'other'],
      brunchMode: false
    },
    mealPlan: null,
    groceryOverrides: {},
    customGroceryItems: [],
    customRecipes: [],
    savedWeeks: [],
    ...overrides
  };
}

function createSavedWeek(id, savedAt) {
  return {
    id,
    savedAt,
    weekOf: '2026-07-06',
    label: `Week ${id}`,
    mealPlan: { weekOf: '2026-07-06', days: [] },
    groceryList: [],
    customGroceryItems: []
  };
}

test('customStaplesReplace allows deleting the last custom staple while legacy empty patches remain blocked', () => {
  const staple = { name: 'Milk', quantity: 1, unit: 'gallon', category: 'dairy' };
  const current = createState({
    preferences: {
      ...createState().preferences,
      customStaples: [staple]
    }
  });

  const legacyPatch = mergeStatePatch(current, {
    preferences: {
      ...current.preferences,
      customStaples: []
    }
  });
  assert.deepEqual(legacyPatch.preferences.customStaples, [staple]);

  const explicitPatch = mergeStatePatch(current, {
    preferences: {
      ...current.preferences,
      customStaples: []
    },
    customStaplesReplace: true
  });
  assert.deepEqual(explicitPatch.preferences.customStaples, []);
  assert.equal(Object.hasOwn(explicitPatch, 'customStaplesReplace'), false);
});

test('savedWeekDeletedIds deletes archives and prevents resurrection from stale savedWeeks patches', () => {
  const older = createSavedWeek('older', '2026-07-01T00:00:00.000Z');
  const deleted = createSavedWeek('deleted', '2026-07-02T00:00:00.000Z');
  const newer = createSavedWeek('newer', '2026-07-03T00:00:00.000Z');
  const current = createState({ savedWeeks: [newer, deleted, older] });

  const deletionPatch = mergeStatePatch(current, {
    savedWeeks: [newer, older],
    savedWeekDeletedIds: ['deleted']
  });
  assert.deepEqual(deletionPatch.savedWeeks.map((week) => week.id), ['newer', 'older']);
  assert.equal(Object.hasOwn(deletionPatch, 'savedWeekDeletedIds'), false);

  const afterDeletion = createState({ savedWeeks: deletionPatch.savedWeeks });
  const stalePatch = mergeStatePatch(afterDeletion, {
    savedWeeks: [newer, deleted, older],
    savedWeekDeletedIds: ['deleted']
  });
  assert.deepEqual(stalePatch.savedWeeks.map((week) => week.id), ['newer', 'older']);
});
