const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');

const load = Module._load;
Module._load = function (name, ...args) {
  if (name === '@react-native-async-storage/async-storage') return {
    getItem: async () => null, setItem: async () => {}, removeItem: async () => {},
  };
  if (name === '@/services/api') return { trackingApi: {} };
  if (name === '@/services/tracking-scope') return { trackingScope: { version: 0 } };
  return load.call(this, name, ...args);
};
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText, filename);

const { mgInSystem, caffeineCurve } = require('../src/features/caffeine/model.ts');
const schedule = require('../src/features/schedule.ts');

const sleep = require('../src/features/sleep/store.ts');

const HOUR = 3_600_000;
const at = (h, m = 0) => new Date(2026, 10, 12, h, m).getTime();
const drink = (mg, t, durationMinutes = 0) => ({ mg, consumedAt: new Date(t).toISOString(), durationMinutes });

test('caffeine halves every 5 hours and matches the design example', () => {
  const coffee = [drink(120, at(8))];
  assert.equal(mgInSystem(coffee, at(7)), 0);
  assert.ok(Math.abs(mgInSystem(coffee, at(13)) - 60) < 0.01);
  assert.equal(Math.round(mgInSystem(coffee, at(14))), 52); // design shows 49 at "now"
  assert.equal(Math.round(mgInSystem(coffee, at(23))), 15); // design: 15 mg at 11 PM bedtime
});

test('remaining caffeine matches backend immediate-dose elimination regardless of legacy sipping metadata', () => {
  assert.equal(mgInSystem([drink(100, at(9), 60)], at(9)), 100);
  assert.ok(Math.abs(mgInSystem([drink(100, at(9), 60)], at(14)) - 50) < 0.01);
});

test('caffeine curve samples every 10 minutes', () => {
  const curve = caffeineCurve([drink(100, at(8))], at(8), at(9));
  assert.equal(curve.length, 7);
  assert.ok(curve[6].mg < curve[1].mg);
});

test('waking day handles times before wake and bedtimes after midnight', () => {
  const day = schedule.wakingDay(7 * 60, 23 * 60, at(14));
  assert.equal(day.wake, at(7));
  assert.equal(day.bedtime, at(23));
  const lateNight = schedule.wakingDay(7 * 60, 23 * 60, at(2));
  assert.equal(lateNight.wake, at(7) - 24 * HOUR);
  const nightOwl = schedule.wakingDay(9 * 60, 60, at(12));
  assert.equal(nightOwl.bedtime, at(9) + 16 * HOUR);
  assert.equal(schedule.nextOccurrence(23 * 60, at(23, 30)), at(23) + 24 * HOUR);
  assert.equal(schedule.formatDuration(462), '7h 42m');
});

test('sleep duration handles midnight and uses explicitly estimated cycles', () => {
  const session = { startedAt: '2026-11-13T23:00:00Z', endedAt: '2026-11-14T07:00:00Z' };
  assert.equal(sleep.sessionMinutes(session), 480);
  assert.equal(sleep.estimateCycles(480), 5);
});

test('removed drink categories are gone from the catalog', () => {
  const { DRINK_CATEGORIES } = require('../src/features/caffeine/catalog.ts');
  const ids = DRINK_CATEGORIES.map((c) => c.id);
  assert.ok(!ids.includes('preworkout') && !ids.includes('pill'));
  assert.ok(ids.includes('other'));
});
