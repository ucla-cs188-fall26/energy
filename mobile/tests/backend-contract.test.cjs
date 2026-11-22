// Live HTTP contract test: production TS services + stores -> real FastAPI routes
// -> in-memory Supabase transport. Never contacts a deployed Supabase project.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const net = require('node:net');
const root = path.resolve(__dirname, '../..');
const uidA = 'a2b8c168-ff6b-4a2b-a9cb-3bc284bf5908';
const uidB = '311b169e-2609-4949-8031-d08adb491c41';
let uid = uidA, invalid = false, signedOut = false, server, authClient = null;
const jwt = () => {
  const encode = v => Buffer.from(JSON.stringify(v)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: uid, exp: 4102444800 })}.synthetic`;
};
const load = Module._load;
Module._load = function(name, ...args) {
  if (name === './supabase') return { supabase: { get auth() { return authClient?.auth ?? { getSession: async () => ({ data: {
    session: signedOut ? null : { user: { id: uid }, access_token: invalid ? 'invalid-synthetic' : jwt() },
  }, error: null }) }; } } };
  if (name === '@react-native-async-storage/async-storage') return { removeItem: async () => {} };
  if (name.startsWith('@/')) return load.call(this, path.join(root, 'mobile/src', name.slice(2) + '.ts'), ...args);
  return load.call(this, name, ...args);
};
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText, filename);
const api = require('../src/services/api.ts');
const { useSleepStore: sleep } = require('../src/features/sleep/store.ts');
const { useCaffeineStore: caffeine } = require('../src/features/caffeine/store.ts');
const { changeTrackingOwner } = require('../src/services/tracking-scope.ts');
const { useTrackingSync: sync } = require('../src/services/tracking-sync.ts');
const nativeFetch = global.fetch;

before(async () => {
  // Reserve an available localhost port; no credentials or sessions in output.
  const port = await new Promise(resolve => {
    const probe = net.createServer(); probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port; probe.close(() => resolve(port));
    });
  });
  process.env.EXPO_PUBLIC_API_URL = `http://127.0.0.1:${port}`;
  const python = process.env.ENERGY_TEST_PYTHON || path.join(root, 'backend/.venv/bin/python');
  server = spawn(python, ['-m', 'uvicorn', 'tests.mock_demo:app', '--host', '127.0.0.1', '--port', String(port),
    '--no-access-log', '--log-level', 'critical'], { cwd: path.join(root, 'backend'), stdio: 'ignore',
      env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' } });
  server.on('error', () => {});
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${process.env.EXPO_PUBLIC_API_URL}/health`)).ok) { ready = true; break; } } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  assert.ok(ready, 'Local mock FastAPI server must start (set ENERGY_TEST_PYTHON if needed)');
  changeTrackingOwner(uid);
});
after(async () => { global.fetch = nativeFetch; server?.kill(); });

test('real Supabase SDK over local HTTP handles signup, login, PKCE recovery, password change and logout', async () => {
  const { createClient } = require('@supabase/supabase-js');
  const values = new Map();
  const storage = { getItem: async k => values.get(k) ?? null, setItem: async (k,v) => values.set(k,v), removeItem: async k => values.delete(k) };
  authClient = createClient(process.env.EXPO_PUBLIC_API_URL, 'sb_publishable_mock_demo', {
    auth: { storage, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, flowType: 'pkce' },
  });
  const auth = require('../src/services/auth.ts');
  const { processAuthCallback } = require('../src/services/auth-links.ts');
  try {
    assert.equal((await auth.signUp('demo@example.invalid', 'demo-test-only')).user.id, uidA);
    assert.equal((await auth.signIn('demo@example.invalid', 'demo-test-only')).session.user.id, uidA);
    assert.ok([...values.keys()].some(key => key.endsWith('-auth-token')));
    assert.equal((await api.getCurrentUser()).id, uidA);
    await auth.requestPasswordReset('demo@example.invalid');
    assert.equal(await processAuthCallback('energyapp://auth/callback?code=synthetic-recovery-flow'), 'recovery');
    await auth.updatePassword('another-demo-test-password');
    await auth.signOut();
    assert.equal((await authClient.auth.getSession()).data.session, null);
  } finally { authClient.auth.stopAutoRefresh(); authClient = null; }
});

test('authenticated profile read, update and completion match the backend contract', async () => {
  assert.equal((await api.getCurrentUser()).id, uidA);
  assert.equal((await api.getProfile()).display_name, 'Demo Student');
  const saved = await api.saveProfile({ display_name: 'Demo Updated', sleep_goal_minutes: null });
  assert.equal(saved.sleep_goal_minutes, null);
  assert.equal(saved.display_name, 'Demo Updated');
  await api.saveProfile({ usual_bedtime: '23:00', usual_wake_time: '07:00', sleep_goal_minutes: 480 });
  assert.equal((await api.completePreferences()).preferences_completed, true);
});

test('sleep start/stop, restored active session, rating and history persist on the server', async () => {
  await sleep.getState().refresh();
  assert.equal(sleep.getState().sessions.length, 1);
  await sleep.getState().startSleep();
  const id = sleep.getState().active.id;
  sleep.getState().reset();
  await sleep.getState().refresh();
  assert.equal(sleep.getState().active.id, id);
  const session = await sleep.getState().stopSleep();
  assert.equal(session.id, id);
  await sleep.getState().rateSleep(id, 5);
  await sleep.getState().refresh();
  assert.equal(sleep.getState().sessions.find(s => s.id === id).quality, 5);
  assert.equal(sleep.getState().active, null);
});

test('nap start/stop and completed nap form both persist real durations and ratings', async () => {
  await sleep.getState().startNap();
  assert.ok(sleep.getState().activeNap.id);
  await sleep.getState().stopNap(4);
  await sleep.getState().logNap({ startedAt: new Date(Date.now() - 40 * 60000).toISOString(),
    endedAt: new Date(Date.now() - 20 * 60000).toISOString(), quality: 5 });
  sleep.getState().reset(); await sleep.getState().refresh();
  assert.equal(sleep.getState().naps.length, 2);
  assert.ok(sleep.getState().naps.some(n => n.quality === 5));
  assert.equal(sleep.getState().activeNap, null);
});

test('caffeine manual and server preset creation, edit, 204 delete and history work', async () => {
  await caffeine.getState().refresh();
  assert.equal(caffeine.getState().presets.length, 5);
  await caffeine.getState().addEntry({ name: 'Demo decaf', mg: 0, servingSizeMl: 237,
    consumedAt: new Date().toISOString(), durationMinutes: 0 });
  let entry = caffeine.getState().entries.find(e => e.name === 'Demo decaf');
  assert.ok(entry);
  await caffeine.getState().updateEntry({ ...entry, name: 'Demo revised', mg: 42 });
  caffeine.getState().reset(); await caffeine.getState().refresh();
  assert.equal(caffeine.getState().entries.find(e => e.id === entry.id).mg, 42);
  await caffeine.getState().removeEntry(entry.id);
  assert.ok(!caffeine.getState().entries.some(e => e.id === entry.id));
  const preset = await api.trackingApi.addCaffeine({ preset_id: 'brewed-coffee', logging_method: 'preset' });
  assert.equal(Number(preset.caffeine_mg), 95);
  assert.equal(Number(preset.serving_size_ml), 237);
});

test('edited amounts with extra decimal places are rounded instead of rejected', async () => {
  await caffeine.getState().addEntry({ name: 'Decimal drink', mg: 80.004, servingSizeMl: 248.4174,
    consumedAt: new Date().toISOString(), durationMinutes: 0 });
  const entry = caffeine.getState().entries.find(e => e.name === 'Decimal drink');
  assert.equal(entry.mg, 80);
  assert.equal(entry.servingSizeMl, 248.42);
  await caffeine.getState().updateEntry({ ...entry, mg: 94.555, servingSizeMl: 300.1234 });
  const edited = caffeine.getState().entries.find(e => e.id === entry.id);
  assert.equal(edited.mg, 94.56);
  assert.equal(edited.servingSizeMl, 300.12);
  await caffeine.getState().removeEntry(entry.id);
});

test('a device clock slightly ahead of the server can still log "now"', async () => {
  const ahead = () => new Date(Date.now() + 2000).toISOString();
  await caffeine.getState().addEntry({ name: 'Fast clock drink', mg: 10, servingSizeMl: 30,
    consumedAt: ahead(), durationMinutes: 0 });
  const entry = caffeine.getState().entries.find(e => e.name === 'Fast clock drink');
  assert.ok(Date.parse(entry.consumedAt) <= Date.now());
  await caffeine.getState().removeEntry(entry.id);
  const before = sleep.getState().naps.length;
  await sleep.getState().logNap({ startedAt: new Date(Date.now() - 20 * 60000).toISOString(), endedAt: ahead() });
  assert.equal(sleep.getState().naps.length, before + 1);
  await assert.rejects(caffeine.getState().addEntry({ name: 'Tomorrow', mg: 10, servingSizeMl: 30,
    consumedAt: new Date(Date.now() + 3600000).toISOString(), durationMinutes: 0 }), e => e.status === 422);
});

test('check-ins persist separately and live prediction includes real caffeine and forecast', async () => {
  const saved = await api.trackingApi.checkin(7);
  assert.equal(saved.energy_rating, 7);
  assert.ok((await api.trackingApi.energyHistory()).some(e => e.id === saved.id));
  const prediction = await api.trackingApi.prediction();
  assert.ok(prediction.score === null || prediction.score >= 0 && prediction.score <= 100);
  assert.ok(prediction.caffeine_remaining_mg > 95);
  assert.equal(prediction.model_type, 'two_process_heuristic');
  assert.equal(prediction.physiological_reference_sleep_hours, 8);
  assert.ok(Array.isArray(prediction.forecast));
  await sync.getState().refresh();
  assert.equal(sync.getState().error, null);
  assert.ok(sync.getState().prediction);
});

test('backend caffeine_remaining_mg matches the app mgInSystem now and across the forecast', async () => {
  const { mgInSystem, HALF_LIFE_MINUTES } = require('../src/features/caffeine/model.ts');
  const hoursAgo = h => new Date(Date.now() - h * 3600000).toISOString();
  const added = [['Parity espresso', 63.5, 0.25], ['Parity cold brew', 200, 3], ['Parity tea', 47.25, 9]];
  for (const [name, mg, h] of added) {
    await caffeine.getState().addEntry({ name, mg, servingSizeMl: 250, consumedAt: hoursAgo(h), durationMinutes: 0 });
  }
  try {
    await caffeine.getState().refresh();
    const entries = caffeine.getState().entries;
    const prediction = await api.trackingApi.prediction();
    // The backend only reads the last 7 days of drinks; anything older is negligible after 7 days.
    const recent = entries.filter(e => Date.parse(prediction.timestamp) - Date.parse(e.consumedAt) <= 7 * 86400000);
    const points = [prediction, ...prediction.forecast];
    assert.ok(points.length > 1, 'forecast should include future points');
    for (const p of points) {
      const app = mgInSystem(recent, Date.parse(p.timestamp));
      assert.ok(Math.abs(p.caffeine_remaining_mg - app) < 0.01,
        `at ${p.timestamp}: backend ${p.caffeine_remaining_mg} mg vs app ${app} mg (half-life ${HALF_LIFE_MINUTES} min)`);
    }
    assert.ok(prediction.caffeine_remaining_mg > 200);
  } finally {
    for (const e of caffeine.getState().entries.filter(e => e.name.startsWith('Parity '))) await caffeine.getState().removeEntry(e.id);
  }
});

test('validation, missing and invalid credentials, and cross-account ownership are enforced', async () => {
  await assert.rejects(api.trackingApi.checkin(11), e => e.status === 422);
  await assert.rejects(api.trackingApi.addCaffeine({ beverage_name: 'bad', caffeine_mg: 10,
    serving_size_ml: 0 }), e => e.status === 422);
  signedOut = true; await assert.rejects(api.getCurrentUser(), /sign in/i); signedOut = false;
  const missing = await nativeFetch(`${process.env.EXPO_PUBLIC_API_URL}/users/me`);
  assert.equal(missing.status, 401);
  invalid = true; await assert.rejects(api.getCurrentUser(), e => e.status === 401); invalid = false;
  const victim = caffeine.getState().entries[0];
  uid = uidB; changeTrackingOwner(uid); sleep.getState().reset(); caffeine.getState().reset(); sync.getState().reset();
  assert.equal(await api.getProfile(), null);
  assert.equal((await api.trackingApi.sleepHistory()).length, 0);
  await assert.rejects(api.trackingApi.updateCaffeine(victim.id, { caffeine_mg: 99 }), e => e.status === 404);
  await assert.rejects(api.trackingApi.deleteCaffeine(victim.id), e => e.status === 404);
  const prediction = await api.trackingApi.prediction();
  assert.equal(prediction.status, 'unavailable'); assert.equal(prediction.score, null);
  uid = uidA; changeTrackingOwner(uid);
});

test('failed writes preserve local data and late responses cannot populate another account', async () => {
  await caffeine.getState().refresh();
  const count = caffeine.getState().entries.length;
  global.fetch = async () => { throw new Error('Offline'); };
  await assert.rejects(caffeine.getState().removeEntry(caffeine.getState().entries[0].id));
  assert.equal(caffeine.getState().entries.length, count);
  let release;
  global.fetch = async (...args) => {
    const response = await nativeFetch(...args);
    await new Promise(r => { release = r; });
    return response;
  };
  const work = caffeine.getState().addEntry({ name: 'Synthetic race test', mg: 10, servingSizeMl: 30,
    consumedAt: new Date().toISOString(), durationMinutes: 0 });
  while (!release) await new Promise(r => setTimeout(r, 5));
  changeTrackingOwner(uidB); caffeine.getState().reset(); release(); await work;
  assert.equal(caffeine.getState().entries.length, 0);
  global.fetch = nativeFetch; uid = uidA; changeTrackingOwner(uid);
});

test('a history refresh started before a save cannot overwrite the saved entry', async () => {
  await caffeine.getState().refresh();
  let release;
  global.fetch = async (...args) => {
    const response = await nativeFetch(...args);
    const url = new URL(String(args[0]));
    if (url.pathname === '/caffeine/logs' && args[1]?.method === 'GET') {
      await new Promise(r => { release = r; });
    }
    return response;
  };
  try {
    const stale = caffeine.getState().refresh();
    while (!release) await new Promise(r => setTimeout(r, 5));
    await caffeine.getState().addEntry({ name: 'Saved during refresh', mg: 25, servingSizeMl: 30,
      consumedAt: new Date().toISOString(), durationMinutes: 0 });
    release(); await stale;
    assert.ok(caffeine.getState().entries.some(e => e.name === 'Saved during refresh'));
  } finally { global.fetch = nativeFetch; }
});
