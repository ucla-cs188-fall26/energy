const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const calls = [];
let reply;
let pending;
const listeners = new Set();
const auth = {
  onAuthStateChange: (listener) => {
    listeners.add(listener);
    return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } };
  },
  exchangeCodeForSession: async (...args) => {
    calls.push(args);
    const result = await (pending || reply);
    if (!result.error) for (const listener of listeners) listener(result.data.redirectType === 'recovery' ? 'PASSWORD_RECOVERY' : 'SIGNED_IN');
    return result;
  },
  signUp: async (input) => { calls.push(input); return { data: {}, error: null }; },
  resetPasswordForEmail: async (...args) => { calls.push(args); return { error: null }; },
  resend: async (input) => { calls.push(input); return { error: null }; },
  updateUser: async (input) => { calls.push(input); return { error: null }; },
};
const load = Module._load;
Module._load = function (name, ...args) {
  if (name === './supabase') return { supabase: { auth } };
  if (name === '@react-native-async-storage/async-storage') return { removeItem: async () => {} };
  return load.call(this, name, ...args);
};
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText, filename);
};
const { processAuthCallback, AUTH_CALLBACK_URL, isAuthCallback } = require('../src/services/auth-links.ts');
const { signUp, requestPasswordReset, resendVerification, updatePassword } = require('../src/services/auth.ts');

test('signup, reset and resend use the exact callback destination', async () => {
  calls.length = 0;
  await signUp(' user@example.com ', 'test-password');
  assert.equal(calls[0].options.emailRedirectTo, AUTH_CALLBACK_URL);
  await requestPasswordReset(' user@example.com ');
  assert.deepEqual(calls[1], ['user@example.com', { redirectTo: AUTH_CALLBACK_URL }]);
  await resendVerification('user@example.com');
  assert.equal(calls[2].options.emailRedirectTo, AUTH_CALLBACK_URL);
  await updatePassword('new-password');
  assert.deepEqual(calls[3], { password: 'new-password' });
});

test('verification code is exchanged and cannot be replayed', async () => {
  reply = { data: { session: {}, redirectType: null }, error: null };
  assert.equal(await processAuthCallback(AUTH_CALLBACK_URL + '?code=verification'), 'verification');
  await assert.rejects(processAuthCallback(AUTH_CALLBACK_URL + '?code=verification'), /invalid, expired, or already used/);
});

for (const [index, base] of [
  'energyapp:///auth/callback',
  'energyapp://auth/callback/',
  'ENERGYAPP://auth/callback',
].entries()) {
  test('equivalent native callback URL form ' + index + ' establishes recovery', async () => {
    reply = { data: { session: {}, redirectType: 'recovery' }, error: null };
    assert.equal(isAuthCallback(base), true);
    assert.equal(await processAuthCallback(base + '?code=normalized-' + index), 'recovery');
  });
}

test('recovery is determined by the verified SDK response, not URL flags', async () => {
  reply = { data: { session: {}, redirectType: 'recovery' }, error: null };
  assert.equal(await processAuthCallback(AUTH_CALLBACK_URL + '?code=recovery&sb_flow_id=flow-1'), 'recovery');
  assert.deepEqual(calls.at(-1), ['recovery', { flowId: 'flow-1' }]);
  reply = { data: { session: {}, redirectType: null }, error: null };
  assert.equal(await processAuthCallback(AUTH_CALLBACK_URL + '?code=spoofed&type=recovery'), 'verification');
});

test('concurrent duplicate delivery exchanges the code once', async () => {
  let resolve;
  pending = new Promise((r) => { resolve = r; });
  const before = calls.length;
  const first = processAuthCallback(AUTH_CALLBACK_URL + '?code=duplicate');
  const second = processAuthCallback(AUTH_CALLBACK_URL + '?code=duplicate');
  resolve({ data: { session: {}, redirectType: null }, error: null });
  assert.deepEqual(await Promise.all([first, second]), ['verification', 'verification']);
  assert.equal(calls.length, before + 1);
  pending = undefined;
});

test('expired, missing-verifier and used-link SDK failures are sanitized', async () => {
  reply = { data: { session: null }, error: new Error('sensitive upstream data') };
  await assert.rejects(processAuthCallback(AUTH_CALLBACK_URL + '?code=expired'), (error) => {
    assert.match(error.message, /Request a new email/);
    assert.ok(!error.message.includes('sensitive'));
    return true;
  });
});

for (const url of [
  'https://example.com/auth/callback?code=x', 'energyapp://evil/callback?code=x',
  'energyapp://auth/callback/extra?code=x', AUTH_CALLBACK_URL,
  AUTH_CALLBACK_URL + '?code=', AUTH_CALLBACK_URL + '?code=a&code=b',
  AUTH_CALLBACK_URL + '?error=access_denied&error_description=private',
  AUTH_CALLBACK_URL + '#access_token=not-a-real-token&refresh_token=not-real',
  AUTH_CALLBACK_URL + '?code=x&access_token=not-real',
]) {
  test('reject malformed or untrusted callback variant ' + String([
    'https://example.com/auth/callback?code=x', 'energyapp://evil/callback?code=x',
    'energyapp://auth/callback/extra?code=x', AUTH_CALLBACK_URL,
    AUTH_CALLBACK_URL + '?code=', AUTH_CALLBACK_URL + '?code=a&code=b',
    AUTH_CALLBACK_URL + '?error=access_denied&error_description=private',
    AUTH_CALLBACK_URL + '#access_token=not-a-real-token&refresh_token=not-real',
    AUTH_CALLBACK_URL + '?code=x&access_token=not-real',
  ].indexOf(url)), async () => {
    const before = calls.length;
    await assert.rejects(processAuthCallback(url));
    assert.equal(calls.length, before);
  });
}

test('unrelated app links are ignored by callback detection', () => {
  assert.equal(isAuthCallback('energyapp://sleep'), false);
});
