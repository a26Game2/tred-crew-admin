import test from 'node:test';
import assert from 'node:assert/strict';
import { rememberLogin, rememberedUsername } from '../src/remember.ts';

const values = new Map();
globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
let saved;
class PasswordCredential { constructor(value) { Object.assign(this, value); } }
Object.defineProperty(globalThis, 'window', { configurable: true, value: { isSecureContext: true, PasswordCredential } });
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { credentials: { store: async value => { saved = value; return value; } } } });

test('remembers only username locally and sends password to browser credential manager', () => {
  values.clear(); saved = undefined;
  rememberLogin('admin', 'test-password', true);
  assert.equal(rememberedUsername(), 'admin');
  assert.equal(saved.id, 'admin');
  assert.equal(saved.password, 'test-password');
  assert.deepEqual([...values.values()], ['admin']);
});

test('unchecked removes username without requesting password storage', () => {
  saved = undefined; rememberLogin('admin', 'test-password', false);
  assert.equal(rememberedUsername(), ''); assert.equal(saved, undefined);
});

test('works when browser does not implement password credentials', () => {
  window.PasswordCredential = undefined;
  assert.doesNotThrow(() => rememberLogin('admin', 'test-password', true));
  assert.equal(rememberedUsername(), 'admin');
});
