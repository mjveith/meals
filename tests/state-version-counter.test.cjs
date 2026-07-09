const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
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

function createLegacyState() {
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
    savedWeeks: []
  };
}

function loadRouteInTempDir() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meals-state-version-'));
  process.env.MEALS_DATA_DIR = tempDir;
  const routePath = path.join(projectRoot, 'src/app/api/state/route.ts');
  delete require.cache[require.resolve(routePath)];
  return { tempDir, route: require(routePath) };
}

async function put(route, patch, etag) {
  const response = await route.PUT(new Request('http://local/api/state', {
    method: 'PUT',
    body: JSON.stringify(patch),
    headers: {
      'content-type': 'application/json',
      ...(etag ? { 'if-match': etag } : {})
    }
  }));
  return {
    response,
    body: await response.json(),
    etag: response.headers.get('etag')
  };
}

test('stateVersion migrates from missing field and increments on the first write', async () => {
  const { tempDir, route } = loadRouteInTempDir();
  fs.writeFileSync(path.join(tempDir, 'meals-state.json'), `${JSON.stringify(createLegacyState(), null, 2)}\n`);

  const before = await route.GET(new Request('http://local/api/state'));
  const beforeBody = await before.json();
  assert.equal(beforeBody.version, 0);

  const firstWrite = await put(route, { preferences: { ...beforeBody.preferences, brunchMode: true } }, before.headers.get('etag'));
  assert.equal(firstWrite.response.status, 200);
  assert.equal(firstWrite.body.version, 1);

  const stored = JSON.parse(fs.readFileSync(path.join(tempDir, 'meals-state.json'), 'utf8'));
  assert.equal(stored.stateVersion, 1);
  assert.equal(Object.hasOwn(firstWrite.body, 'stateVersion'), false);
});

test('stateVersion strictly increases across consecutive writes in the same millisecond', async () => {
  const { route } = loadRouteInTempDir();

  const initial = await route.GET(new Request('http://local/api/state'));
  const initialBody = await initial.json();

  const firstWrite = await put(route, { preferences: { ...initialBody.preferences, brunchMode: true } }, initial.headers.get('etag'));
  const secondWrite = await put(route, { preferences: { ...firstWrite.body.preferences, brunchMode: false } }, firstWrite.etag);

  assert.equal(firstWrite.response.status, 200);
  assert.equal(secondWrite.response.status, 200);
  assert.ok(secondWrite.body.version > firstWrite.body.version);
  assert.equal(secondWrite.body.version, firstWrite.body.version + 1);
  assert.notEqual(secondWrite.etag, firstWrite.etag);
  assert.equal(Object.hasOwn(secondWrite.body, 'stateVersion'), false);
});
