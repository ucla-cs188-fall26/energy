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
  return load.call(this, name, ...args);
};
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText, filename);

const { mgInSystem, caffeineCurve } = require('../src/features/caffeine/model.ts');
const schedule = require('../src/features/schedule.ts');
const { forecast, energyAt } = require('../src/features/energy/forecast.ts');
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

test('slow drinks are only partly in the system while still being drunk', () => {
  const sipped = [drink(100, at(9), 60)];
  const half = mgInSystem(sipped, at(9, 30));
  assert.ok(half > 45 && half < 55, `expected about half absorbed, got ${half}`);
  assert.ok(mgInSystem(sipped, at(10)) > 90);
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

test('placeholder forecast puts the dip mid-afternoon for a 7 AM wake', () => {
  const f = forecast(at(13), at(7), at(23));
  assert.ok(f.now >= 70);
  assert.notEqual(f.dip, null);
  const dip = new Date(f.dip);
  assert.equal(dip.getHours(), 16);
  assert.ok(energyAt(at(16, 30), at(7)) < f.now - 10);
  assert.ok(f.steadyHours > 1 && f.steadyHours < 3.5);
  assert.equal(forecast(at(21), at(7), at(23)).dip, null);
});

test('sleep sessions record start and stop, discarding accidental taps', () => {
  const store = sleep.useSleepStore;
  const ago = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString();

  store.getState().startSleep();
  const started = store.getState().active.startedAt;
  store.getState().startSleep(); // a second tap keeps the original start
  assert.equal(store.getState().active.startedAt, started);

  store.setState({ active: { startedAt: ago(2) } });
  assert.equal(store.getState().stopSleep(), null);
  assert.equal(store.getState().active, null);
  assert.equal(store.getState().sessions.length, 0);

  store.setState({ active: { startedAt: ago(462) } });
  const session = store.getState().stopSleep();
  assert.equal(Math.round(sleep.sessionMinutes(session)), 462);
  assert.equal(store.getState().sessions.length, 1);
  assert.equal(store.getState().active, null);
  assert.equal(sleep.estimateCycles(462), 5);
});

test('after bedtime, Home shows tomorrow\'s forecast starting at wake time', () => {
  const { homeForecast } = require('../src/features/energy/forecast.ts');
  // 3:53 AM: the waking day that started yesterday at 7 AM ended at 11 PM.
  const day = schedule.wakingDay(7 * 60, 23 * 60, at(3, 53));
  const f = homeForecast(at(3, 53), day.wake, day.bedtime);
  assert.equal(f.night, true);
  assert.equal(f.start, at(7));
  assert.equal(new Date(f.points.at(-1).t).getHours(), 23);
  assert.notEqual(f.dip, null);
  assert.equal(new Date(f.dip).getHours(), 16);
  assert.equal(homeForecast(at(13), at(7), at(23)).night, false);
});

test('naps are logged and removed separately from nightly sleep', () => {
  const store = sleep.useSleepStore;
  const before = store.getState().sessions.length;
  store.getState().logNap({ startedAt: new Date(at(14)).toISOString(), endedAt: new Date(at(14, 20)).toISOString() });
  const [nap] = store.getState().naps;
  assert.equal(sleep.sessionMinutes(nap), 20);
  assert.equal(store.getState().sessions.length, before);
  store.getState().removeNap(nap.id);
  assert.equal(store.getState().naps.length, 0);
});

test('removed drink categories are gone from the catalog', () => {
  const { DRINK_CATEGORIES } = require('../src/features/caffeine/catalog.ts');
  const ids = DRINK_CATEGORIES.map((c) => c.id);
  assert.ok(!ids.includes('preworkout') && !ids.includes('pill'));
  assert.ok(ids.includes('other'));
});
