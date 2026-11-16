const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

const memory = new Map();
let activeUser = null, failSave = false, saved = [], cached = null;
const api = {
  saveProfile: async (preferences, expected) => {
    saved.push({ preferences, expected });
    if (failSave) throw new Error('Offline');
    return { ...preferences, id: expected };
  },
  completePreferences: async (expected) => ({ id: expected, preferences_completed: true }),
};
const load = Module._load;
Module._load = function (name, ...args) {
  if (name === '@react-native-async-storage/async-storage') return {
    getItem: async (k) => memory.get(k) ?? null,
    setItem: async (k, v) => { memory.set(k, v); },
    removeItem: async (k) => { memory.delete(k); },
  };
  if (name === '@/hooks/useAuth') return { useAuth: () => ({ session: null }) };
  if (name === '@/services/supabase') return { supabase: { auth: { getSession: async () => ({ data: { session: activeUser ? { user: activeUser } : null } }) } } };
  if (name === '@/services/api') return api;
  if (name === '@/features/profile/store') return { useProfileStore: { getState: () => ({ setProfile: profile => { cached = profile; } }) } };
  if (name === './store') return load.call(this, path.join(__dirname, '../src/features/onboarding/store.ts'), ...args);
  return load.call(this, name, ...args);
};
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText, filename);

const store = require('../src/features/onboarding/store.ts');
const { toProfilePreferences, syncPendingProfile } = require('../src/features/onboarding/sync.ts');

test('clock formatting wraps around midnight', () => {
  assert.equal(store.formatClock(23 * 60), '11:00 PM');
  assert.equal(store.formatClock(7 * 60), '7:00 AM');
  assert.equal(store.formatClock(0), '12:00 AM');
  assert.equal(store.formatClock(12 * 60 + 30), '12:30 PM');
  assert.equal(store.formatClock(-60), '11:00 PM');
  assert.equal(store.toApiTime(23 * 60 + 30), '23:30');
  assert.equal(store.toApiTime(24 * 60 + 5), '00:05');
});

test('sleep window spans midnight', () => {
  assert.equal(store.sleepWindowMinutes(23 * 60, 7 * 60), 8 * 60);
  assert.equal(store.sleepWindowMinutes(22 * 60 + 30, 6 * 60), 7 * 60 + 30);
  assert.equal(store.formatDuration(7 * 60 + 30), '7h 30m');
  assert.equal(store.formatDuration(8 * 60), '8h');
});

test('medium sensitivity with an 11 PM bedtime suggests 3 PM cutoff, as in the design', () => {
  const cutoff = 23 * 60 - store.CAFFEINE_CUTOFF_HOURS.medium * 60;
  assert.equal(store.formatClock(cutoff), '3:00 PM');
});

test('BMI matches the design example', () => {
  assert.equal(store.bmi(70, 175).toFixed(1), '22.9');
  assert.equal(store.bmi(null, 175), null);
});

test('answers map to backend profile fields', () => {
  const prefs = toProfilePreferences({
    ...store.initialAnswers,
    caffeineFrequency: 'few_times_week',
    sideEffects: ['jitters', 'energy_crash'],
    sensitivity: 'high',
    sex: 'female', ageYears: 29, weightKg: 70, heightCm: 175,
    fullName: 'Alex Smith',
  });
  assert.deepEqual(prefs, {
    display_name: 'Alex Smith',
    usual_bedtime: '23:00',
    usual_wake_time: '07:00',
    sleep_goal_minutes: 480,
    caffeine_frequency: 'few_times_week',
    caffeine_sensitivity: 'high',
    selected_side_effects: ['jitters', 'energy_crash'],
    sex: 'female', age_years: 29, weight_kg: 70, height_cm: 175,
    measurement_units: 'metric',
  });
  // Unanswered side effects are sent as an empty list (the API rejects null).
  assert.deepEqual(toProfilePreferences(store.initialAnswers).selected_side_effects, []);
});

test('onboarding sync is account-bound, retryable and clears answers only after persistence', async () => {
  const user = { id: 'synthetic-user', email: 'demo@example.invalid' };
  activeUser = user;
  store.useOnboardingStore.getState().set({ pendingSync: true, signupEmail: 'someone-else@example.invalid', fullName: 'Someone Else' });
  await syncPendingProfile(user);
  assert.equal(saved.length, 0);
  store.useOnboardingStore.getState().set({ signupEmail: user.email, fullName: 'Demo', caffeineFrequency: 'daily' });
  failSave = true;
  await assert.rejects(syncPendingProfile(user), /Offline/);
  assert.equal(store.useOnboardingStore.getState().pendingSync, true);
  failSave = false;
  await syncPendingProfile(user);
  assert.equal(saved.at(-1).expected, user.id);
  assert.equal(cached.preferences_completed, true);
  assert.equal(store.useOnboardingStore.getState().pendingSync, false);
});
