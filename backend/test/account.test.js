const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const A = require('../src/services/account');

process.env.JWT_SECRET = 'test-secret';

test('username and password rules', () => {
  assert.equal(A.validUsername('  شيخ '), 'شيخ');
  const bad = fn => assert.throws(fn, e => e.status === 400);
  bad(() => A.validUsername('ab')); bad(() => A.validUsername('a b c')); bad(() => A.validUsername('x'.repeat(41)));
  assert.equal(A.validPassword('12345678'), '12345678');
  bad(() => A.validPassword('1234567')); bad(() => A.validPassword(null));
});

test('limiter locks a name after 5 failures, for 10 minutes, case-insensitively', () => {
  let t = 0;
  const L = A.createLimiter({ now: () => t });
  for (let i = 0; i < 4; i++) L.fail('Admin');
  L.check('admin'); // 4 failures: still allowed
  L.fail('admin');
  assert.throws(() => L.check('ADMIN'), e => e.status === 429 && /10 دقائق/.test(e.message));
  t += 9 * 60000;
  assert.throws(() => L.check('admin'), e => /دقيقة/.test(e.message));
  t += 60001;
  L.check('admin'); // unlocked
  L.fail('admin'); L.check('admin'); // counting starts again
  L.success('admin');
});

// ── controller + middleware on an in-memory users table
const users = [];
const um = require.resolve(path.join(__dirname, '../src/models/UserModel'));
require.cache[um] = { id: um, filename: um, loaded: true, exports: {
  count: async () => users.length,
  findByUsername: async u => users.find(x => x.username === u),
  findById: async id => users.find(x => x.id === Number(id)),
  createFirst: async (username, password_hash) => {
    if (users.length) return null;
    const u = { id: 1, username, password_hash, token_version: 0 }; users.push(u); return { ...u };
  },
  recordLogin: async id => { const u = users.find(x => x.id === id); u.previous_login_at = u.last_login_at; u.last_login_at = 'now'; },
  setUsername: async (id, username) => { users.find(x => x.id === id).username = username; },
  setPassword: async (id, h) => { const u = users.find(x => x.id === id); u.password_hash = h; u.token_version++; },
  bumpTokenVersion: async id => { users.find(x => x.id === id).token_version++; },
} };
const c = require('../src/controllers/authController');
const auth = require('../src/middleware/auth');
const call = async (fn, req) => { let body; await fn({ body: {}, ...req }, { json: b => { body = b; } }); return body; };
const authed = async token => {
  let status = 200, user;
  await auth({ headers: { authorization: `Bearer ${token}` } }, { status: s => { status = s; return { json: () => {} }; } }, () => {});
  if (status === 200) user = true;
  return status;
};

test('first run creates the only account; a second setup is refused', async () => {
  assert.deepEqual(await call(c.status), { setup: true });
  const r = await call(c.setup, { body: { username: 'admin', password: 'secret123' } });
  assert.ok(r.token);
  assert.deepEqual(await call(c.status), { setup: false });
  await assert.rejects(call(c.setup, { body: { username: 'other', password: 'secret123' } }), e => e.status === 403);
});

test('login, wrong password, rename and password change', async () => {
  c.limiter.success('admin');
  await assert.rejects(call(c.login, { body: { username: 'admin', password: 'nope' } }), e => e.status === 401);
  const { token } = await call(c.login, { body: { username: 'admin', password: 'secret123', remember: true } });
  assert.equal(jwt.decode(token).exp - jwt.decode(token).iat, 30 * 86400);
  assert.equal(await authed(token), 200);

  const me = { user: { id: 1 } };
  await assert.rejects(call(c.changeUsername, { ...me, body: { username: 'shaykh', password: 'bad' } }), e => e.status === 403);
  assert.equal((await call(c.changeUsername, { ...me, body: { username: 'shaykh', password: 'secret123' } })).username, 'shaykh');

  await assert.rejects(call(c.changePassword, { ...me, body: { current: 'secret123', next: 'short' } }), e => e.status === 400);
  await assert.rejects(call(c.changePassword, { ...me, body: { current: 'secret123', next: 'secret123' } }), e => e.status === 400);
  const r = await call(c.changePassword, { ...me, body: { current: 'secret123', next: 'newsecret1' } });
  assert.equal(await authed(token), 401, 'old token signed out');
  assert.equal(await authed(r.token), 200, 'this device keeps a fresh token');
  assert.ok(await bcrypt.compare('newsecret1', users[0].password_hash));

  const o = await call(c.logoutOthers, me);
  assert.equal(await authed(r.token), 401);
  assert.equal(await authed(o.token), 200);
});

test('tokens issued before token versions existed stay valid', async () => {
  users[0].token_version = 0;
  const old = jwt.sign({ id: 1, username: 'shaykh' }, process.env.JWT_SECRET);
  assert.equal(await authed(old), 200);
});
