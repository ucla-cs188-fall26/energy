// Pure window / sampling / bedtime logic behind the "Caffeine in your system" chart.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText, filename);

const { mgInSystem } = require('../src/features/caffeine/model.ts');
const chart = require('../src/features/caffeine/chartWindow.ts');
const { nextBedtime } = require('../src/features/schedule.ts');

const MIN = 60_000;
const HOUR = 60 * MIN;
const at = (d, h, m = 0) => new Date(2026, 10, d, h, m).getTime();
const drink = (mg, t) => ({ mg, consumedAt: new Date(t).toISOString(), durationMinutes: 0 });

test('window is 24h with now exactly at the center sample', () => {
  const now = at(19, 8, 7);
  const { t0, t1 } = chart.chartWindow(now);
  assert.equal(t0, now - 12 * HOUR); assert.equal(t1, now + 12 * HOUR);
  const pts = chart.sampleWindow([], now);
  assert.equal(pts.length, 24 * 6 + 1);
  assert.equal(pts[0].t, t0); assert.equal(pts[pts.length - 1].t, t1);
  assert.equal(pts[(pts.length - 1) / 2].t, now);
  assert.ok(pts.every(p => p.mg === 0));
});

test('doses before the window start still contribute', () => {
  const now = at(19, 12);
  const old = drink(200, now - 15 * HOUR);
  const pts = chart.sampleWindow([old], now);
  assert.ok(pts[0].mg > 0);
  assert.ok(Math.abs(pts[0].mg - mgInSystem([old], pts[0].t)) < 1e-9);
});

test('sampled curve is exactly mgInSystem, so the Now dot and label match the tile', () => {
  const now = at(19, 9, 10);
  const doses = [drink(140, at(19, 8, 50)), drink(300, at(19, 9))];
  const pts = chart.sampleWindow(doses, now);
  for (const p of pts) assert.equal(p.mg, mgInSystem(doses, p.t));
  const center = pts.find(p => p.t === now);
  assert.equal(center.mg, mgInSystem(doses, now));
});

test('each drink draws as a vertical step at its exact time (no slanted ramp or dip)', () => {
  const now = at(19, 9, 10);
  const doses = [drink(140, at(19, 8, 53)), drink(300, at(19, 9, 2))];
  const pts = chart.sampleWindow(doses, now);
  for (const d of doses) {
    const t = Date.parse(d.consumedAt);
    const i = pts.findIndex(p => p.t === t);
    assert.ok(i > 0 && pts[i - 1].t === t - 1);
    assert.ok(Math.abs(pts[i].mg - pts[i - 1].mg - d.mg) < 0.01);
  }
  assert.ok(pts.every((p, i) => i === 0 || p.t > pts[i - 1].t));
  // Between the two drinks the level only eases down slightly, never dips toward zero.
  const between = pts.filter(p => p.t >= at(19, 8, 53) && p.t < at(19, 9, 2));
  assert.ok(between.every(p => p.mg > 135));
});

test('y-axis fits the peak with headroom, rounded to a gridline', () => {
  assert.equal(chart.yMax([{ t: 0, mg: 0 }]), 100);
  assert.equal(chart.yMax([{ t: 0, mg: 140 }]), 200);
  assert.equal(chart.yMax([{ t: 0, mg: 300 }]), 400);
  assert.equal(chart.yMax([{ t: 0, mg: 500 }]), 600);
});

test('empty state only when nothing was logged in the past 24h', () => {
  const now = at(19, 12);
  assert.equal(chart.noRecentDoses([], now), true);
  assert.equal(chart.noRecentDoses([drink(95, now - 25 * HOUR)], now), true);
  assert.equal(chart.noRecentDoses([drink(95, now - 23 * HOUR)], now), false);
});

test('axis ticks are whole hours 6h apart around now', () => {
  const ticks = chart.axisTicks(at(19, 9, 10));
  assert.deepEqual(ticks, [at(18, 21), at(19, 3), at(19, 9), at(19, 15), at(19, 21)]);
});

test('next bedtime is always in the future, including across midnight', () => {
  assert.equal(nextBedtime(23 * 60, at(19, 14)), at(19, 23));
  assert.equal(nextBedtime(23 * 60, at(19, 23)), at(20, 23)); // exactly at bedtime: the next one
  assert.equal(nextBedtime(90, at(19, 23)), at(20, 1, 30)); // 1:30 AM bedtime, evening now
  assert.equal(nextBedtime(90, at(20, 2)), at(21, 1, 30)); // up past a 1:30 AM bedtime
  assert.equal(nextBedtime(null, at(19, 14)), null);
  assert.equal(nextBedtime(undefined, at(19, 14)), null);
});

test('next bedtime keeps the clock time across a DST change', () => {
  // Day before a typical fall-back/spring-forward boundary in many locales; the result
  // must land on 11 PM local whatever the offset change.
  for (const [m, d] of [[2, 7], [9, 25], [10, 1]]) {
    const now = new Date(2026, m, d, 23, 30).getTime();
    const bed = new Date(nextBedtime(23 * 60, now));
    assert.equal(bed.getHours(), 23); assert.equal(bed.getMinutes(), 0);
    assert.equal(bed.getDate(), new Date(2026, m, d + 1).getDate());
  }
});

test('bedtime projection is lower than now when bedtime is hours away (At-bedtime card fix)', () => {
  const now = at(20, 1, 0);
  const doses = [drink(135, now - 5 * MIN)];
  const bed = nextBedtime(90, now); // 1:30 AM the following night
  assert.ok(bed > now);
  assert.ok(mgInSystem(doses, bed) < mgInSystem(doses, now));
  const soon = nextBedtime(23 * 60, at(19, 18));
  assert.ok(mgInSystem([drink(135, at(19, 18))], soon) < 135);
});

test('dragging maps a touch to a snapped time inside the window', () => {
  const now = at(19, 12, 3);
  const { t0, t1 } = chart.chartWindow(now);
  assert.equal(chart.scrubTime(-50, 300, now), Math.ceil(t0 / (5 * MIN)) * 5 * MIN);
  assert.equal(chart.scrubTime(9999, 300, now), Math.floor(t1 / (5 * MIN)) * 5 * MIN);
  // The middle of the chart is now, snapped to 5 minutes.
  assert.equal(chart.scrubTime(150, 300, now), at(19, 12, 5));
  // A quarter of the way across is 6 hours before now.
  assert.equal(chart.scrubTime(75, 300, now), at(19, 6, 5));
});

test('the dragged cursor reads the same value as the drawn line, past and projected', () => {
  const now = at(19, 12);
  const doses = [drink(200, at(19, 8))];
  const pts = chart.sampleWindow(doses, now);
  // On a sample it is exactly the curve.
  for (const p of pts.filter((_, i) => i % 7 === 0)) assert.equal(chart.valueAt(pts, p.t), p.mg);
  // Between samples it stays within the neighbours and close to the true amount.
  const between = at(19, 15, 5);
  const v = chart.valueAt(pts, between);
  assert.ok(Math.abs(v - mgInSystem(doses, between)) < 1);
  assert.ok(chart.valueAt(pts, at(19, 9)) > chart.valueAt(pts, at(19, 20)));
  assert.equal(chart.valueAt(pts, at(19, 7, 55)), 0);
  assert.equal(chart.valueAt([], now), 0);
});
