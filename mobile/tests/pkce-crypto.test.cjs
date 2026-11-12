const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { webcrypto } = require('node:crypto');

test('native PKCE uses native secure randomness and SHA-256', async () => {
  const calls = [];
  const native = {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    getRandomValues: (array) => { calls.push('random'); return webcrypto.getRandomValues(array); },
    digest: (algorithm, data) => { calls.push(algorithm); return webcrypto.subtle.digest(algorithm, data); },
  };
  const context = vm.createContext({ exports: {}, require: (name) => {
    if (name === 'expo-crypto') return native;
    if (name === 'react-native') return { Platform: { OS: 'ios' } };
    throw new Error('Unexpected module');
  } });
  const code = ts.transpileModule(fs.readFileSync('src/services/pkce-crypto.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInContext(code, context);
  const crypto = vm.runInContext('crypto', context);
  crypto.getRandomValues(new Uint8Array(32));
  const data = new TextEncoder().encode('PKCE test');
  const result = await crypto.subtle.digest('SHA-256', data);
  assert.deepEqual(Buffer.from(result), Buffer.from(await webcrypto.subtle.digest('SHA-256', data)));
  assert.deepEqual(calls, ['random', 'SHA-256']);
});
