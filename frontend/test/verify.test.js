import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyUrl } from '../src/utils/verify.js';

test('verifyUrl joins the base and the token, trimming slashes and encoding the token', () => {
  assert.equal(verifyUrl('abc_DEF-123', 'http://192.168.1.20:8080/'), 'http://192.168.1.20:8080/v/abc_DEF-123');
  assert.equal(verifyUrl('a b', 'https://isnad.example.com'), 'https://isnad.example.com/v/a%20b');
});
