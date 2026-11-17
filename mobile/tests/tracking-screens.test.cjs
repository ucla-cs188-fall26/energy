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
let simulationRequests = [], simulationFailure = false, simulationWait = null;
async function simulationRequest(path, init) {
  const body = JSON.parse(init.body);
  simulationRequests.push({ path, method: init.method, body });
  if (simulationWait) await simulationWait;
  if (simulationFailure) throw new Error('Simulation unavailable in this environment');
  const value = body.duration_minutes === 480 ? 86 : 60;
  return { simulation: true, simulated_sleep_minutes: body.duration_minutes, score: value,
    status: 'estimated', timestamp: new Date().toISOString(), caffeine_remaining_mg: 42,
    forecast: [{ timestamp: new Date(Date.now()+3600000).toISOString(), score: value - 5, status: 'estimated', caffeine_remaining_mg: 36 }] };
}
let calls = [], routes = [], alerts = [], failSave = false, score = 73;
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
  if (name === '@/services/api' || name === './api') return { trackingApi, getProfile: () => profileRequest(), request: simulationRequest, localTimezone: () => "America/Los_Angeles" };
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
const { useDevelopmentSimulation } = require('../src/services/development-simulation.ts');
const { ForecastChart } = require('../src/features/energy/ForecastChart.tsx');
const { refreshProfile, useProfileStore } = require('../src/features/profile/store.ts');
const { changeTrackingOwner, trackingScope } = require('../src/services/tracking-scope.ts');
function content(tree) { return tree.root.findAllByType('Text').map(n => n.children.join('')).join(' '); }
function button(tree, label) {
  return tree.root.findAllByType('Pressable').find(p => p.findAllByType('Text').some(t => t.children.join('') === label));
}
async function render(Component, props) { let tree; await act(async () => { tree = create(React.createElement(Component, props)); }); return tree; }
async function cleanup(tree) { await act(async () => tree.unmount()); }
beforeEach(() => {
  calls = []; routes = []; alerts = []; failSave = false; score = 73;
  global.__DEV__ = false; simulationRequests = []; simulationFailure = false; simulationWait = null;
  useDevelopmentSimulation.getState().reset();
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

test('development sleep preview updates the existing energy circle/forecast and Reset restores real predictions', async () => {
  global.__DEV__ = true;
  const tree = await render(Home);
  try {
    const sessions = useSleepStore.getState().sessions;
    await act(async () => button(tree, 'Simulate Sleep').props.onPress());
    for (const label of ['30 minutes', '1 hour', '4 hours', '6 hours', '8 hours']) assert.ok(button(tree, label));
    await act(async () => button(tree, '4 hours').props.onPress());
    assert.match(content(tree), /Simulation · 240 minutes/);
    assert.match(content(tree), /60%/);
    assert.equal(useTrackingSync.getState().prediction.score, 73);
    assert.equal(tree.root.findByType(ForecastChart).props.forecast.points[1].value, 55);
    assert.equal(useSleepStore.getState().sessions, sessions);
    assert.deepEqual(simulationRequests[0], { path: '/development/energy/simulate', method: 'POST', body: { duration_minutes: 240, timezone: 'America/Los_Angeles' } });
    score = 41;
    await act(async () => useTrackingSync.getState().refresh());
    assert.match(content(tree), /60%/); // Real refresh cannot overwrite the preview.
    await act(async () => button(tree, 'Simulate Sleep').props.onPress());
    await act(async () => button(tree, '8 hours').props.onPress());
    assert.match(content(tree), /86%/);
    assert.equal(tree.root.findByType(ForecastChart).props.forecast.points[1].value, 81);
    await act(async () => button(tree, 'Reset Simulation').props.onPress());
    assert.match(content(tree), /41%/);
    assert.doesNotMatch(content(tree), /Not saved/);
    assert.equal(useDevelopmentSimulation.getState().prediction, null);
  } finally { await cleanup(tree); }
});

test('simulation controls and requests are disabled in a production build', async () => {
  useDevelopmentSimulation.setState({ scope: trackingScope.version, prediction: {
    simulation: true, simulated_sleep_minutes: 240, score: 99, status: 'estimated', forecast: [], timestamp: new Date().toISOString(), caffeine_remaining_mg: 42,
  } });
  const tree = await render(Home);
  try {
    assert.equal(button(tree, 'Simulate Sleep'), undefined);
    assert.equal(await useDevelopmentSimulation.getState().simulate(240), false);
    assert.equal(simulationRequests.length, 0);
    assert.match(content(tree), /73%/);
    assert.doesNotMatch(content(tree), /99%|Not saved/);
  } finally { await cleanup(tree); }
});

test('failed preview leaves actual prediction visible and reports the error', async () => {
  global.__DEV__ = true; simulationFailure = true;
  const tree = await render(Home);
  try {
    await act(async () => button(tree, 'Simulate Sleep').props.onPress());
    await act(async () => button(tree, '4 hours').props.onPress());
    assert.match(content(tree), /Simulation unavailable/);
    assert.match(content(tree), /73%/);
    assert.equal(useDevelopmentSimulation.getState().prediction, null);
  } finally { await cleanup(tree); }
});

test('Reset cancels an in-flight preview and ignores its late result', async () => {
  global.__DEV__ = true;
  let release;
  simulationWait = new Promise(resolve => { release = resolve; });
  const tree = await render(Home);
  let work;
  try {
    await act(async () => { work = useDevelopmentSimulation.getState().simulate(240); });
    await act(async () => button(tree, 'Reset Simulation').props.onPress());
    await act(async () => { release(); await work; });
    assert.equal(useDevelopmentSimulation.getState().prediction, null);
    assert.match(content(tree), /73%/);
  } finally { release(); await cleanup(tree); }
});

test('a preview response from a previous account is discarded', async () => {
  global.__DEV__ = true;
  let release;
  simulationWait = new Promise(resolve => { release = resolve; });
  const work = useDevelopmentSimulation.getState().simulate(240);
  changeTrackingOwner('other'); useDevelopmentSimulation.getState().reset();
  release();
  assert.equal(await work, false);
  assert.equal(useDevelopmentSimulation.getState().prediction, null);
});
