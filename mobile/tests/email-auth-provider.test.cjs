const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
let authState, initialUrl, incoming, state, exchanges, refreshes, updated, fail, updateFail, removed;
const values = new Map();
const recoveryKey = 'energy.auth.passwordRecovery';
const link = 'energyapp://auth/callback?code=test-only';
const storage = {
  getItem: async (key) => values.get(key) ?? null,
  setItem: async (key, value) => { values.set(key, value); },
  removeItem: async (key) => { values.delete(key); },
};
const load = Module._load;
Module._load = function (name, ...args) {
  if (name === '@react-native-async-storage/async-storage') return storage;
  if (name === 'expo-linking') return {
    getInitialURL: async () => initialUrl,
    addEventListener: (_name, fn) => { incoming = fn; return { remove: () => { removed = true; } }; },
  };
  if (name === '@/hooks/useAuth') return { useAuth: () => authState };
  if (name === '@/services/auth') return { updatePassword: async () => {
    if (updateFail) throw new Error('Password requirements not met');
    updated += 1;
  } };
  if (name === '@/services/auth-links') return {
    RECOVERY_STORAGE_KEY: recoveryKey,
    isAuthCallback: (url) => url.startsWith('energyapp://auth/callback'),
    processAuthCallback: async (url) => {
      exchanges += 1;
      if (fail) throw new Error('sensitive details must not be shown');
      return url.includes('recovery') ? 'recovery' : 'verification';
    },
  };
  return load.call(this, name, ...args);
};
require.extensions['.tsx'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, filename);
const { EmailAuthProvider, useEmailAuth } = require('../src/hooks/useEmailAuth.tsx');
function Probe() { state = useEmailAuth(); return null; }
async function mount(url = null, recovering = false) {
  exchanges = refreshes = updated = 0;
  fail = updateFail = removed = false;
  initialUrl = url;
  values.clear();
  if (recovering) values.set(recoveryKey, 'true');
  authState = { session: recovering ? { user: {} } : null, loading: false, refreshSessionState: async () => {
    refreshes += 1;
    authState.session = { user: {} };
  } };
  let tree;
  await act(async () => { tree = create(React.createElement(EmailAuthProvider, null, React.createElement(Probe))); });
  return tree;
}

test('cold-start verification processes the initial URL and restores auth state', async () => {
  const tree = await mount(link);
  try {
    assert.equal(exchanges, 1);
    assert.equal(refreshes, 1);
    assert.equal(state.ready, true);
    assert.equal(state.success, true);
    assert.equal(state.recovery, false);
  } finally { await act(async () => tree.unmount()); }
  assert.equal(removed, true);
});

test('warm recovery links persist the reset gate and duplicate delivery is ignored', async () => {
  const tree = await mount();
  try {
    await act(async () => {
      incoming({ url: link + '-recovery' });
      incoming({ url: link + '-recovery' });
    });
    assert.equal(state.recovery, true);
    assert.equal(values.get(recoveryKey), 'true');
    assert.equal(exchanges, 1);
    updateFail = true;
    await assert.rejects(state.finishRecovery('test-password'), /requirements/);
    assert.equal(state.recovery, true);
    updateFail = false;
    await act(async () => { await state.finishRecovery('test-password'); });
    assert.equal(updated, 1);
    assert.equal(state.recovery, false);
    assert.equal(values.has(recoveryKey), false);
  } finally { await act(async () => tree.unmount()); }
});

test('recovery mode is restored after restarting the app', async () => {
  const tree = await mount(null, true);
  try { assert.equal(state.recovery, true); }
  finally { await act(async () => tree.unmount()); }
});

test('invalid links show a generic error without changing auth', async () => {
  const tree = await mount();
  try {
    fail = true;
    await act(async () => { incoming({ url: link }); });
    assert.equal(state.success, false);
    assert.match(state.error, /invalid, expired, or already used/);
    assert.ok(!state.error.includes('sensitive'));
    assert.equal(refreshes, 0);
    assert.equal(authState.session, null);
  } finally { await act(async () => tree.unmount()); }
});

test('password update requires a verified recovery session', async () => {
  const tree = await mount();
  try {
    await assert.rejects(state.finishRecovery('test-password'), /valid password-reset email/);
    assert.equal(updated, 0);
  } finally { await act(async () => tree.unmount()); }
});

test('unrelated deep links do not run an auth exchange', async () => {
  const tree = await mount();
  try {
    await act(async () => { incoming({ url: 'energyapp://sleep' }); });
    assert.equal(exchanges, 0);
    assert.equal(state.error, null);
  } finally { await act(async () => tree.unmount()); }
});
