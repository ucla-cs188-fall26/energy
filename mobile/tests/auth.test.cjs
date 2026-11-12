// Exercise our TypeScript services with the real Supabase auth client and mocked I/O.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');

const values = new Map();
const storage = {
  getItem: async (key) => values.get(key) ?? null,
  setItem: async (key, value) => { values.set(key, value); },
  removeItem: async (key) => { values.delete(key); },
};
const load = Module._load;
Module._load = function (name, ...args) {
  if (name === 'react-native') return { Platform: { OS: 'ios' } };
  if (name === '@react-native-async-storage/async-storage') return storage;
  if (name === 'react-native-url-polyfill/auto') return {};
  if (name === './pkce-crypto') return {}; // Node already provides WebCrypto.
  return load.call(this, name, ...args);
};
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  });
  module._compile(outputText, filename);
};
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://auth-test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
process.env.EXPO_PUBLIC_API_URL = 'http://api.test';

const user = {
  id: 'a2b8c168-ff6b-4a2b-a9cb-3bc284bf5908', email: 'user@example.com',
  aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {},
  created_at: new Date().toISOString(),
};
const expiresAt = Math.floor(Date.now() / 1000) + 3600;
const jwt = (version) => {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp: expiresAt, version })}.signature`;
};
const sessionResponse = (version) => ({
  access_token: jwt(version), refresh_token: `refresh-${version}`,
  expires_in: 3600, token_type: 'bearer', user,
});
let confirmationRequired = false;
let invalidPassword = false;
let rejectApi = false;
const calls = [];
global.fetch = async (input, init = {}) => {
  const url = String(input);
  calls.push({ url, init });
  let body;
  let status = 200;
  if (new URL(url).pathname.endsWith('/signup')) {
    assert.equal(new URL(url).searchParams.get('redirect_to'), 'energyapp://auth/callback');
    body = confirmationRequired ? user : sessionResponse(1);
  }
  else if (url.includes('grant_type=password')) {
    status = invalidPassword ? 400 : 200;
    body = invalidPassword ? { msg: 'Invalid login credentials', code: 'invalid_credentials' } : sessionResponse(1);
  } else if (url.includes('grant_type=refresh_token')) body = sessionResponse(2);
  else if (url.includes('grant_type=pkce')) {
    const payload = JSON.parse(init.body);
    assert.ok(payload.code_verifier);
    body = sessionResponse(3);
  }
  else if (new URL(url).pathname.endsWith('/recover')) {
    assert.equal(new URL(url).searchParams.get('redirect_to'), 'energyapp://auth/callback');
    const payload = JSON.parse(init.body);
    assert.equal(payload.code_challenge_method, 's256');
    body = {};
  }
  else if (new URL(url).pathname.endsWith('/user') && init.method === 'PUT') {
    assert.equal(JSON.parse(init.body).password, 'test-new-password');
    body = user;
  }
  else if (url.includes('/logout')) { status = 204; }
  else if (url.endsWith('/users/me')) {
    assert.equal(init.headers.Authorization, `Bearer ${jwt(2)}`);
    status = rejectApi ? 401 : 200;
    body = rejectApi ? { detail: 'Invalid token' } : { id: user.id, email: user.email };
  } else throw new Error(`Unexpected network request: ${url}`);
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json' },
  });
};

const { supabase } = require('../src/services/supabase.ts');
const { signUp, signIn, signOut, requestPasswordReset, updatePassword } = require('../src/services/auth.ts');
const { processAuthCallback } = require('../src/services/auth-links.ts');
const { getCurrentUser } = require('../src/services/api.ts');

test('signup confirmation, login errors, persisted sessions, refresh, bearer API calls, and logout', async () => {
  const events = [];
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => events.push(event));
  try {
    confirmationRequired = true;
    assert.equal((await signUp(' user@example.com ', 'test-password')).session, null);
    assert.equal(JSON.parse(calls.find((call) => new URL(call.url).pathname.endsWith('/signup')).init.body).email, user.email);
    invalidPassword = true;
    await assert.rejects(signIn(user.email, 'wrong-password'), /Invalid login credentials/);
    invalidPassword = false;
    const signedIn = await signIn(user.email, 'test-password');
    assert.equal(signedIn.session.user.id, user.id);
    const persisted = [...values.entries()].find(([key]) => key.endsWith('-auth-token'));
    assert.ok(persisted, 'session written to native storage');
    assert.equal(JSON.parse(persisted[1]).refresh_token, 'refresh-1');

    // Simulate a fresh client after an app restart using the same persisted storage.
    const { createClient } = require('@supabase/supabase-js');
    const restored = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
      auth: { storage, storageKey: 'restored-session', autoRefreshToken: false, persistSession: true, detectSessionInUrl: false },
    });
    await storage.setItem('restored-session', persisted[1]);
    assert.equal((await restored.auth.getSession()).data.session.user.id, user.id);
    restored.auth.stopAutoRefresh();
    await storage.removeItem('restored-session');

    const refreshed = await supabase.auth.refreshSession();
    assert.equal(refreshed.error, null);
    assert.equal(refreshed.data.session.access_token, jwt(2));
    assert.deepEqual(await getCurrentUser(), { id: user.id, email: user.email });
    rejectApi = true;
    await assert.rejects(getCurrentUser(), /Session expired/);
    await signOut();
    assert.equal((await supabase.auth.getSession()).data.session, null);
    assert.equal(values.has(persisted[0]), false);
    await assert.rejects(getCurrentUser(), /Please sign in/);
    assert.ok(events.includes('SIGNED_IN'));
    assert.ok(events.includes('TOKEN_REFRESHED'));
    assert.ok(events.includes('SIGNED_OUT'));
    confirmationRequired = false;
    assert.equal((await signUp(user.email, 'test-password')).session.user.id, user.id);
    await signOut();
    await requestPasswordReset(user.email);
    assert.equal(await processAuthCallback('energyapp://auth/callback?code=real-sdk-test-code'), 'recovery');
    assert.equal((await supabase.auth.getSession()).data.session.user.id, user.id);
    await updatePassword('test-new-password');
    await signOut();
  } finally {
    subscription.unsubscribe();
    supabase.auth.stopAutoRefresh();
  }
});
