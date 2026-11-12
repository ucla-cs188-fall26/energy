const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;

let listener;
let restore;
let signInError;
const session = { user: { id: 'test-user', email: 'user@example.com' } };
const auth = {
  signIn: async () => {
    if (signInError) throw new Error('Invalid login credentials');
    return { session };
  },
  signUp: async () => ({ session: null }),
  signOut: async () => {},
};
const supabase = { auth: {
  onAuthStateChange: (callback) => {
    listener = callback;
    return { data: { subscription: { unsubscribe() {} } } };
  },
  getSession: () => new Promise((resolve) => { restore = resolve; }),
  startAutoRefresh() {}, stopAutoRefresh() {},
} };
const load = Module._load;
Module._load = function (name, ...args) {
  if (name === 'react-native') return { Platform: { OS: 'ios' }, AppState: {
    currentState: 'active', addEventListener: () => ({ remove() {} }),
  } };
  if (name === '@/services/supabase') return { supabase };
  if (name === '@/services/auth') return auth;
  return load.call(this, name, ...args);
};
require.extensions['.tsx'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  });
  module._compile(outputText, filename);
};
const { AuthProvider, useAuth } = require('../src/hooks/useAuth.tsx');
let state;
function Probe() { state = useAuth(); return null; }
async function mount() {
  signInError = false;
  let tree;
  await act(async () => { tree = create(React.createElement(AuthProvider, null, React.createElement(Probe))); });
  return tree;
}
const restored = (value) => ({ data: { session: value }, error: null });

test('login updates the route-guard session even when no auth event arrives', async () => {
  const tree = await mount();
  try {
    await act(async () => { restore(restored(null)); });
    assert.equal(state.loading, false);
    assert.equal(state.session, null);
    await act(async () => { await state.signIn('user@example.com', 'test-password'); });
    assert.equal(state.session, session);
    await act(async () => { await state.signOut(); });
    assert.equal(state.session, null);
  } finally { await act(async () => tree.unmount()); }
});

test('late startup results cannot overwrite a successful login', async () => {
  const tree = await mount();
  try {
    await act(async () => { await state.signIn('user@example.com', 'test-password'); });
    await act(async () => {
      restore(restored(null));
      listener('INITIAL_SESSION', null);
    });
    assert.equal(state.session, session);
    await act(async () => { listener('SIGNED_OUT', null); });
    assert.equal(state.session, null);
  } finally { await act(async () => tree.unmount()); }
});

test('startup restores an existing session without depending on an auth event', async () => {
  const tree = await mount();
  try {
    await act(async () => { restore(restored(session)); });
    assert.equal(state.loading, false);
    assert.equal(state.session, session);
  } finally { await act(async () => tree.unmount()); }
});

test('failed login surfaces the error and does not authenticate', async () => {
  const tree = await mount();
  try {
    await act(async () => { restore(restored(null)); });
    signInError = true;
    await act(async () => {
      await assert.rejects(state.signIn('user@example.com', 'wrong-password'), /Invalid login credentials/);
    });
    assert.equal(state.session, null);
  } finally { await act(async () => tree.unmount()); }
});
