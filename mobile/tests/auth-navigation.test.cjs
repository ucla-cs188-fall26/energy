const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
let auth, email, redirects, passwordUpdates;
const Stack = ({ children }) => React.createElement('Stack', null, children);
Stack.Screen = (props) => React.createElement('Screen', props);
Stack.Protected = ({ guard, children }) => guard ? React.createElement(React.Fragment, null, children) : null;
const passthrough = ({ children }) => children;
const load = Module._load;
Module._load = function (name, ...args) {
  if (name === 'expo-router') return {
    Stack, router: { replace: (path) => redirects.push(path) },
    Redirect: ({ href }) => React.createElement('Redirect', { href }),
  };
  if (name === 'expo-status-bar') return { StatusBar: () => null };
  if (name === 'react-native') return {
    View: 'View', Text: 'Text', ActivityIndicator: 'ActivityIndicator', Button: 'Button', TextInput: 'TextInput',
  };
  if (name === '@/hooks/useAuth') return { AuthProvider: passthrough, useAuth: () => auth };
  if (name === '@/hooks/useEmailAuth') return { EmailAuthProvider: passthrough, useEmailAuth: () => email };
  if (name === '@/services/auth-links') return { AUTHENTICATED_DESTINATION: '/(tabs)' };
  return load.call(this, name, ...args);
};
require.extensions['.tsx'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, filename);
const Root = require('../app/_layout.tsx').default;
const Reset = require('../app/auth/reset-password.tsx').default;
const Callback = require('../app/auth/callback.tsx').default;
function defaults() {
  redirects = [];
  passwordUpdates = [];
  auth = { session: null, loading: false };
  email = { ready: true, processing: false, recovery: false, error: null, success: false, resultId: 0,
    finishRecovery: async (password) => passwordUpdates.push(password) };
}
async function render(Component) {
  let tree;
  await act(async () => { tree = create(React.createElement(Component)); });
  return tree;
}

test('navigator stays mounted throughout cold-start and warm callback processing', async () => {
  defaults();
  auth.loading = true;
  email.ready = false;
  const tree = await render(Root);
  try {
    assert.equal(tree.root.findAllByType('Stack').length, 1);
    assert.equal(tree.root.findAllByType('Screen').some((s) => s.props.name === 'auth/callback'), true);
    auth.loading = false;
    email.ready = true;
    email.processing = true;
    await act(async () => tree.update(React.createElement(Root)));
    assert.equal(tree.root.findAllByType('Stack').length, 1);
    assert.deepEqual(redirects, []);
    auth.session = { user: {} };
    email = { ...email, processing: false, recovery: true, success: true, resultId: 1 };
    await act(async () => tree.update(React.createElement(Root)));
    assert.equal(redirects.at(-1), '/auth/reset-password');
    assert.equal(tree.root.findAllByType('Screen').some((s) => s.props.name === '(auth)/login'), false);
  } finally { await act(async () => tree.unmount()); }
});

test('verification routes home and a subsequent recovery result still routes to reset', async () => {
  defaults();
  auth.session = { user: {} };
  email.success = true;
  email.resultId = 1;
  const tree = await render(Root);
  try {
    assert.deepEqual(redirects, ['/(tabs)']);
    email.recovery = true;
    email.resultId = 2;
    await act(async () => tree.update(React.createElement(Root)));
    assert.deepEqual(redirects, ['/(tabs)', '/auth/reset-password']);
  } finally { await act(async () => tree.unmount()); }
});

test('invalid or consumed links remain on the public callback error screen', async () => {
  defaults();
  email.error = 'This link is invalid, expired, or already used.';
  email.resultId = 1;
  const tree = await render(Root);
  try { assert.deepEqual(redirects, ['/auth/callback']); }
  finally { await act(async () => tree.unmount()); }
});

test('reset screen waits for auth restoration instead of redirecting to sign in', async () => {
  defaults();
  auth.loading = true;
  email.ready = false;
  const tree = await render(Reset);
  try { assert.equal(tree.root.findAllByType('Redirect').length, 0); }
  finally { await act(async () => tree.unmount()); }
});

test('reset form confirms passwords before sending the new password', async () => {
  defaults();
  auth.session = { user: {} };
  email.recovery = true;
  const tree = await render(Reset);
  try {
    const inputs = tree.root.findAllByType('TextInput');
    await act(async () => { inputs[0].props.onChangeText('new-test-password'); inputs[1].props.onChangeText('different'); });
    let save = tree.root.findAllByType('Button').find((b) => b.props.title === 'Save password');
    await act(async () => { await save.props.onPress(); });
    assert.deepEqual(passwordUpdates, []);
    await act(async () => inputs[1].props.onChangeText('new-test-password'));
    save = tree.root.findAllByType('Button').find((b) => b.props.title === 'Save password');
    await act(async () => { await save.props.onPress(); });
    assert.equal(passwordUpdates.length, 1);
  } finally { await act(async () => tree.unmount()); }
});

test('callback waits while session restoration is pending', async () => {
  defaults();
  auth.loading = true;
  const tree = await render(Callback);
  try { assert.equal(tree.root.findAllByType('ActivityIndicator').length, 1); }
  finally { await act(async () => tree.unmount()); }
});
