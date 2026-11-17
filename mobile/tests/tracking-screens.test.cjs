// Component interactions use real screen/store code and synthetic API responses.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
let profileRequest = async () => null;
let calls = [], routes = [], alerts = [], failSave = false, score = 73, searchParams = {};
const start = () => new Date(Date.now() - 8 * 3600000).toISOString();
const row = (extra = {}) => ({ id: 'synthetic-session', user_id: 'demo', started_at: start(),
  ended_at: new Date().toISOString(), duration_seconds: 28800, elapsed_seconds: 28800, ...extra });
const trackingApi = {
  sleepHistory: async () => [row({ sleep_quality: 2 })], napHistory: async () => [],
  activeSleep: async () => null, activeNap: async () => null,
  caffeineHistory: async () => [], presets: async () => [], energyHistory: async () => [],
  prediction: async () => ({ score, timestamp: new Date().toISOString(), caffeine_remaining_mg: 42,
    status: score === null ? 'unavailable' : 'estimated', forecast: [] }),
  startSleep: async () => { calls.push('startSleep'); if (failSave) throw new Error('Offline'); return row({ ended_at: null }); },
  rateSleep: async (id, rating) => { calls.push(['rateSleep', id, rating]); return row({ sleep_quality: rating }); },
  logNap: async (...args) => { calls.push(['logNap', ...args]); if (failSave) throw new Error('Offline'); return row({ refreshed_rating: args[2] }); },
  addCaffeine: async body => { calls.push(['addCaffeine', body]); if (failSave) throw new Error('Offline');
    return { id: 'drink', ...body }; },
  checkin: async rating => { calls.push(['checkin', rating]); return { id: 'checkin', energy_rating: rating, recorded_at: new Date().toISOString() }; },
};
const memory = new Map();
const native = { StyleSheet: { create: x => x }, Platform: { OS: 'ios' },
  Alert: { alert: (...args) => alerts.push(args) }, AppState: { addEventListener: () => ({ remove() {} }) },
  BackHandler: { addEventListener: () => ({ remove() {} }) } };
for (const name of ['View', 'Text', 'Pressable', 'ScrollView', 'TextInput', 'Modal', 'ActivityIndicator']) native[name] = name;
const load = Module._load;
Module._load = function(name, ...args) {
  if (name === 'react-native') return native;
  if (name === 'react-native-safe-area-context') return { SafeAreaView: 'SafeAreaView' };
  if (name === 'react-native-svg') return { __esModule: true, default: 'Svg', Circle: 'Circle', Path: 'Path', Rect: 'Rect', Line: 'Line' };
  if (name === '@expo/vector-icons') return { Ionicons: 'Icon' };
  if (name === 'expo-router') return { router: { push: route => routes.push(route), back: () => routes.push('back'),
      replace: route => routes.push(route), canGoBack: () => true }, useLocalSearchParams: () => searchParams,
    useFocusEffect: callback => React.useEffect(callback, [callback]) };
  if (name === '@react-native-async-storage/async-storage') return {
    getItem: async key => memory.get(key) ?? null, setItem: async (k,v) => memory.set(k,v), removeItem: async k => memory.delete(k),
  };
  if (name === '@/hooks/useAuth') return { useAuth: () => ({ session: { user: { id: 'demo', email: 'demo@example.invalid' } } }) };
  if (name === '@/services/api' || name === './api') return { trackingApi, getProfile: () => profileRequest() };
  if (name === '@/services/supabase') return { supabase: { auth: { getSession: async () => ({ data: { session: { user: { id: 'demo' } } } }) } } };
  if (name.startsWith('@/')) {
    const base = path.join(__dirname, '../src', name.slice(2));
    return load.call(this, fs.existsSync(base + '.tsx') ? base + '.tsx' : base + '.ts', ...args);
  }
  return load.call(this, name, ...args);
};
for (const ext of ['.ts', '.tsx']) require.extensions[ext] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, filename);
const Home = require('../app/(tabs)/index.tsx').default;
const Nap = require('../app/log-nap.tsx').default;
const Insights = require('../app/(tabs)/insights.tsx').default;
const Sleep = require('../app/(tabs)/sleep.tsx').default;
const { DrinkDetailSheet } = require('../src/features/caffeine/DrinkDetailSheet.tsx');
const { useSleepStore } = require('../src/features/sleep/store.ts');
const { useCaffeineStore } = require('../src/features/caffeine/store.ts');
const { useTrackingSync } = require('../src/services/tracking-sync.ts');
const { refreshProfile, useProfileStore } = require('../src/features/profile/store.ts');
const { changeTrackingOwner } = require('../src/services/tracking-scope.ts');
function content(tree) { return tree.root.findAllByType('Text').map(n => n.children.join('')).join(' '); }
function button(tree, label) {
  return tree.root.findAllByType('Pressable').find(p => p.findAllByType('Text').some(t => t.children.join('') === label));
}
async function render(Component, props) { let tree; await act(async () => { tree = create(React.createElement(Component, props)); }); return tree; }
async function cleanup(tree) { await act(async () => tree.unmount()); }
beforeEach(() => {
  calls = []; routes = []; alerts = []; failSave = false; score = 73; searchParams = {};
  changeTrackingOwner('demo'); useSleepStore.getState().reset(); useCaffeineStore.getState().reset(); useTrackingSync.getState().reset();
});

test('dashboard shows the API score, real quality and caffeine, with a safe empty forecast', async () => {
  const tree = await render(Home);
  try {
    assert.match(content(tree), /73%/); assert.match(content(tree), /Quality 2\/5/);
    assert.match(content(tree), /42 mg/); assert.doesNotMatch(content(tree), /4\/5/);
    failSave = true;
    await act(async () => button(tree, 'Start sleep').props.onPress());
    assert.equal(routes.length, 0); assert.equal(alerts.length, 1);
    failSave = false;
    await act(async () => button(tree, 'Start sleep').props.onPress());
    assert.deepEqual(routes, ['/sleeping']);
  } finally { await cleanup(tree); }
});

test('missing recorded sleep renders unavailable rather than a fabricated percentage', async () => {
  score = null; const tree = await render(Home);
  try { assert.match(content(tree), /Energy unavailable/); assert.doesNotMatch(content(tree), /\d+%/); }
  finally { await cleanup(tree); }
});

test('nap form submits timestamps and refreshed rating; failed save stays on screen', async () => {
  const tree = await render(Nap);
  try {
    // Logging a past nap is the second option on the nap screen.
    await act(async () => button(tree, 'Log a past nap').props.onPress());
    await act(async () => button(tree, '5').props.onPress());
    failSave = true; await act(async () => button(tree, 'Save nap').props.onPress());
    assert.deepEqual(routes, []); assert.equal(alerts.length, 1);
    failSave = false; await act(async () => button(tree, 'Save nap').props.onPress());
    const save = calls.filter(c => c[0] === 'logNap').at(-1);
    assert.equal(save[3], 5); assert.equal((Date.parse(save[2]) - Date.parse(save[1])) / 60000, 20);
    assert.deepEqual(routes, ['back']);
  } finally { await cleanup(tree); }
});

test('custom drink requires volume, accepts decaf and sends a complete validated body', async () => {
  let logged = 0;
  const tree = await render(DrinkDetailSheet, { category: { id: 'other', name: 'Other', options: [] }, onClose() {}, onLogged() { logged++; } });
  try {
    const inputs = tree.root.findAllByType('TextInput');
    await act(async () => { inputs[0].props.onChangeText('Demo decaf'); inputs[1].props.onChangeText('0'); });
    assert.equal(button(tree, 'Enter caffeine and serving volume').props.disabled, true);
    await act(async () => inputs[2].props.onChangeText('237'));
    await act(async () => button(tree, 'Log 0 mg').props.onPress());
    const body = calls.find(c => c[0] === 'addCaffeine')[1];
    assert.equal(body.beverage_name, 'Demo decaf'); assert.equal(body.caffeine_mg, 0);
    assert.equal(body.serving_size_ml, 237); assert.equal(body.logging_method, 'manual'); assert.equal(logged, 1);
  } finally { await cleanup(tree); }
});

test('sleep tab has no Last sleep card; History shows the stored quality', async () => {
  const tree = await render(Sleep);
  try {
    assert.doesNotMatch(content(tree), /Last sleep/); assert.doesNotMatch(content(tree), /Light 52%/);
    await act(async () => button(tree, 'History').props.onPress());
    assert.match(content(tree), /Quality 2\/5/);
  } finally { await cleanup(tree); }
});

test('Naps today only lists naps that ended during the current local day', () => {
  const { napsOnDay } = require('../src/features/sleep/store.ts');
  const at = (d, h, m = 0) => new Date(2026, 10, d, h, m).toISOString();
  const nap = (id, s, e) => ({ id, startedAt: s, endedAt: e, quality: 3 });
  const naps = [nap('yesterday', at(16, 14), at(16, 14, 30)), nap('late', at(16, 23, 50), at(17, 0, 10)),
    nap('noon', at(17, 12), at(17, 12, 20)), nap('morning', at(17, 9), at(17, 9, 15))];
  const ids = (now) => napsOnDay(naps, now).map(n => n.id);
  assert.deepEqual(ids(new Date(2026, 10, 17, 15).getTime()), ['noon', 'morning', 'late']);
  // Just after midnight the list starts empty again.
  assert.deepEqual(ids(new Date(2026, 10, 18, 0, 1).getTime()), []);
  assert.deepEqual(ids(new Date(2026, 10, 16, 20).getTime()), ['yesterday']);
});

test('energy check-in form records the chosen rating and shows it in history', async () => {
  const tree = await render(Insights);
  try {
    await act(async () => button(tree, '8').props.onPress());
    await act(async () => button(tree, 'Save check-in').props.onPress());
    assert.deepEqual(calls.find(c => c[0] === 'checkin'), ['checkin', 8]);
    assert.match(content(tree), /8\/10/);
  } finally { await cleanup(tree); }
});

test('a late profile refresh cannot erase a more recently saved profile', async () => {
  let release;
  profileRequest = () => new Promise(resolve => { release = resolve; });
  useProfileStore.getState().setProfile(null);
  const refresh = refreshProfile();
  while (!release) await new Promise(resolve => setTimeout(resolve, 1));
  const saved = { id: 'demo', display_name: 'Just saved' };
  useProfileStore.getState().setProfile(saved);
  release(null); await refresh;
  assert.equal(useProfileStore.getState().profile, saved);
});

test('a newly saved drink appears immediately even when the screen clock is thirty seconds old', async () => {
  const { useCaffeineSummary } = require('../src/features/caffeine/useCaffeineSummary.ts');
  const { useTodayEntries } = require('../src/features/caffeine/store.ts');
  const oldClock = Date.now() - 30_000;
  function Summary() {
    const summary = useCaffeineSummary(oldClock);
    const entries = useTodayEntries(oldClock);
    return React.createElement('Text', null, JSON.stringify({ total: summary.todayMg, remaining: summary.inSystemMg, count: entries.length }));
  }
  const tree = await render(Summary);
  try {
    const drink = { id: 'just-saved', name: 'New coffee', mg: 95, consumedAt: new Date().toISOString(), durationMinutes: 0 };
    await act(async () => useCaffeineStore.setState({ entries: [drink] }));
    assert.deepEqual(JSON.parse(content(tree)), { total: 95, remaining: 95, count: 1 });
    await act(async () => useCaffeineStore.setState({ entries: [drink, { ...drink, id: 'future', consumedAt: new Date(Date.now() + 3600000).toISOString() }] }));
    assert.deepEqual(JSON.parse(content(tree)), { total: 95, remaining: 95, count: 1 });
  } finally { await cleanup(tree); }
});

test('active sleep offers Resume sleep and explains the unavailable forecast', async () => {
  const tree = await render(Home);
  try {
    await act(async () => {
      useSleepStore.setState({ active: { id: 'active', startedAt: new Date().toISOString() } });
      useTrackingSync.setState({ prediction: { score: null, status: 'sleeping', timestamp: new Date().toISOString(), caffeine_remaining_mg: 0, forecast: [] } });
    });
    assert.ok(button(tree, 'Resume sleep'));
    assert.match(content(tree), /Stop the active sleep or nap session/);
    assert.doesNotMatch(content(tree), /check your connection/);
  } finally { await cleanup(tree); }
});

test('saved nap refreshed ratings are displayed in both summary and history', async () => {
  const original = trackingApi.napHistory;
  trackingApi.napHistory = async () => [row({ id: 'rated-nap', refreshed_rating: 4 })];
  const tree = await render(Sleep);
  try {
    assert.match(content(tree), /Refreshed 4\/5/);
    await act(async () => button(tree, 'History').props.onPress());
    assert.match(content(tree), /Refreshed 4\/5/);
    assert.match(content(tree), /Quality 2\/5/);
  } finally { await cleanup(tree); trackingApi.napHistory = original; }
});

test('Start nap opens the dark Napping screen; the sheet has no rating question', async () => {
  trackingApi.startNap = async () => { calls.push('startNap'); return row({ ended_at: null }); };
  const tree = await render(Nap);
  try {
    assert.match(content(tree), /Ready for a nap\?/);
    assert.doesNotMatch(content(tree), /How refreshed/);
    await act(async () => button(tree, 'Start nap').props.onPress());
    assert.ok(calls.includes('startNap'));
    assert.deepEqual(routes, ['/napping']);
  } finally { await cleanup(tree); delete trackingApi.startNap; }
});

test('past nap needs a rating before it can be saved', async () => {
  const tree = await render(Nap);
  try {
    await act(async () => button(tree, 'Log a past nap').props.onPress());
    assert.equal(button(tree, 'Save nap').props.disabled, true);
    await act(async () => button(tree, '3').props.onPress());
    assert.equal(button(tree, 'Save nap').props.disabled, false);
  } finally { await cleanup(tree); }
});

test('past nap uses a start/end time range that cannot end in the future', async () => {
  const tree = await render(Nap);
  const stepper = (label) => tree.root.findAllByType('Pressable').find(p => p.props.accessibilityLabel === label);
  try {
    await act(async () => button(tree, 'Log a past nap').props.onPress());
    assert.doesNotMatch(content(tree), /When did you wake up|How long did you nap/);
    assert.match(content(tree), /Start time/); assert.match(content(tree), /End time/);
    assert.match(content(tree), /Nap length 20m/);
    // The default end is the latest allowed (now), so it can only move earlier.
    assert.equal(stepper('Later end time').props.disabled, true);
    await act(async () => stepper('Earlier start time').props.onPress());
    assert.match(content(tree), /Nap length 25m/);
    // Shortening stops at 5 minutes.
    for (let i = 0; i < 10; i++) await act(async () => { if (!stepper('Later start time').props.disabled) stepper('Later start time').props.onPress(); });
    assert.match(content(tree), /Nap length 5m/);
    await act(async () => button(tree, '2').props.onPress());
    await act(async () => button(tree, 'Save nap').props.onPress());
    const save = calls.filter(c => c[0] === 'logNap').at(-1);
    assert.equal((Date.parse(save[2]) - Date.parse(save[1])) / 60000, 5);
    assert.ok(Date.parse(save[2]) <= Date.now());
  } finally { await cleanup(tree); }
});

test('Stop nap goes straight to the rating screen for that nap', async () => {
  const Napping = require('../app/napping.tsx').default;
  trackingApi.stopNap = async (id, rating) => { calls.push(['stopNap', id, rating]); return row({ id }); };
  useSleepStore.setState({ activeNap: { id: 'nap-1', startedAt: start() } });
  const tree = await render(Napping);
  try {
    await act(async () => button(tree, 'Stop nap').props.onPress());
    assert.deepEqual(calls.find(c => c[0] === 'stopNap'), ['stopNap', 'nap-1', undefined]);
    assert.deepEqual(routes.at(-1), { pathname: '/rate-session', params: { kind: 'nap', id: 'nap-1' } });
  } finally { await cleanup(tree); delete trackingApi.stopNap; }
});

test('rating screen cannot be saved without an answer, then saves the sleep quality', async () => {
  const Rate = require('../app/rate-session.tsx').default;
  trackingApi.rateSleep = async (id, rating) => { calls.push(['rateSleep', id, rating]); return row({ id, sleep_quality: rating }); };
  useSleepStore.setState({ sessions: [{ id: 'night-1', startedAt: start(), endedAt: new Date().toISOString(), quality: null }] });
  searchParams = { kind: 'sleep', id: 'night-1' };
  const tree = await render(Rate);
  try {
    assert.match(content(tree), /How refreshed do you feel\?/);
    assert.equal(button(tree, 'Save').props.disabled, true);
    await act(async () => button(tree, '4').props.onPress());
    await act(async () => button(tree, 'Save').props.onPress());
    assert.deepEqual(calls.find(c => c[0] === 'rateSleep'), ['rateSleep', 'night-1', 4]);
    assert.deepEqual(routes, ['back']);
  } finally { await cleanup(tree); delete trackingApi.rateSleep; }
});

test('the most recent unrated sleep or nap from the last day is the one asked about', () => {
  const { findPendingRating } = require('../src/features/sleep/rating.ts');
  const now = Date.parse('2026-11-17T15:00:00Z');
  const s = (id, endedAt, quality = null) => ({ id, startedAt: '2026-11-16T00:00:00Z', endedAt, quality });
  const nights = [s('old', '2026-11-15T07:00:00Z'), s('rated', '2026-11-17T07:00:00Z', 4), s('night', '2026-11-17T06:00:00Z')];
  const naps = [s('nap', '2026-11-17T14:00:00Z')];
  assert.deepEqual(findPendingRating(nights, naps, now), { kind: 'nap', session: naps[0] });
  assert.deepEqual(findPendingRating(nights, [], now), { kind: 'sleep', session: nights[2] });
  assert.equal(findPendingRating([nights[0], nights[1]], [], now), null); // too old / already rated
});

test('rating screen greets by wake-up time, and Home shows a face for every energy level', async () => {
  const { greeting } = require('../src/features/schedule.ts');
  const at = (h) => new Date(2026, 10, 17, h, 30).getTime();
  assert.deepEqual([greeting(at(7)), greeting(at(11)), greeting(at(12)), greeting(at(16)), greeting(at(17))],
    ['Good morning', 'Good morning', 'Good afternoon', 'Good afternoon', 'Good evening']);

  const Rate = require('../app/rate-session.tsx').default;
  useSleepStore.setState({ sessions: [{ id: 'late', startedAt: new Date(at(4)).toISOString(), endedAt: new Date(at(13)).toISOString(), quality: null }] });
  searchParams = { kind: 'sleep', id: 'late' };
  let tree = await render(Rate);
  try { assert.match(content(tree), /Good afternoon/); assert.doesNotMatch(content(tree), /Good morning/); }
  finally { await cleanup(tree); }

  const face = (t) => t.root.findAll(n => n.props && typeof n.props.accessibilityLabel === 'string' && n.props.accessibilityLabel.endsWith(' face'))[0].props.accessibilityLabel;
  for (const [value, expected] of [[85, 'happy face'], [45, 'tired face'], [null, 'neutral face']]) {
    score = value; tree = await render(Home);
    try {
      assert.equal(face(tree), expected);
      assert.doesNotMatch(content(tree), /Formula estimate/);
      if (value !== null) assert.match(content(tree), /Estimated from your sleep, naps and caffeine\./);
    } finally { await cleanup(tree); }
  }
});
