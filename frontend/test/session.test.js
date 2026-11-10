import { test } from 'node:test';
import assert from 'node:assert/strict';

const fake = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }; };
Object.defineProperty(globalThis, 'localStorage', { value: fake(), configurable: true });
Object.defineProperty(globalThis, 'sessionStorage', { value: fake(), configurable: true });
const S = await import('../src/utils/session.js');

test('remember me keeps the token in localStorage, otherwise in sessionStorage only', () => {
  S.saveSession('t1', 'admin', true);
  assert.equal(localStorage.getItem('token'), 't1');
  assert.equal(sessionStorage.getItem('token'), null);
  assert.equal(S.isRemembered(), true);

  S.saveSession('t2', 'admin', false);
  assert.equal(localStorage.getItem('token'), null, 'switching off remember me clears the stored token');
  assert.equal(S.getToken(), 't2');
  assert.equal(S.isRemembered(), false);
});

test('a refreshed token stays where the session was; clear removes both', () => {
  S.saveSession('t3', 'admin', true);
  S.saveSession('t4', 'shaykh');           // remember not given: keep the current place
  assert.equal(localStorage.getItem('token'), 't4');
  assert.equal(S.getUsername(), 'shaykh');
  S.clearSession();
  assert.equal(S.getToken(), null);
});
