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
    for (const candidate of candidates) if (fs.existsSync(candidate)) return candidate;
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = function compileTs(module, filename) {
    const source = fs.readFileSync(filename, 'utf8');
    const output = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, resolveJsonModule: true },
      fileName: filename
    });
    module._compile(output.outputText, filename);
  };
}

const { getMonday, toIsoDate, formatWeekLabel } = require(path.join(projectRoot, 'src/lib/date.ts'));
const { createPlanFromConfig, normalizePlan } = require(path.join(projectRoot, 'src/lib/meal-generator.ts'));
const { DEFAULT_PREFERENCES } = require(path.join(projectRoot, 'src/lib/constants.ts'));

function withMockedNow(isoString, callback) {
  const RealDate = Date;
  class MockDate extends RealDate {
    constructor(...args) { return args.length === 0 ? new RealDate(isoString) : new RealDate(...args); }
    static now() { return new RealDate(isoString).getTime(); }
  }
  MockDate.UTC = RealDate.UTC;
  MockDate.parse = RealDate.parse;
  global.Date = MockDate;
  try { callback(); } finally { global.Date = RealDate; }
}

test('getMonday targets the upcoming Monday when today is Sunday', () => {
  assert.equal(toIsoDate(getMonday(new Date('2026-05-03T12:00:00-07:00'))), '2026-05-04');
  assert.equal(formatWeekLabel('2026-05-04'), 'Week of May 4');
});

test('Sunday plan generation and normalization use the following Monday, not the prior week', () => {
  withMockedNow('2026-05-03T12:00:00-07:00', () => {
    const plan = createPlanFromConfig(DEFAULT_PREFERENCES);
    assert.equal(plan.weekOf, '2026-05-04');
    assert.equal(plan.days[0].date, '2026-05-04');
    assert.equal(formatWeekLabel(plan.weekOf), 'Week of May 4');
    assert.equal(normalizePlan({ ...plan, weekOf: '2026-04-27' }, DEFAULT_PREFERENCES), null);
    assert.equal(normalizePlan(plan, DEFAULT_PREFERENCES).weekOf, '2026-05-04');
  });
});
