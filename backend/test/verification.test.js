const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const codes = require('../src/utils/codes');
const rateLimit = require('../src/middleware/rateLimit');
const IS = require('../src/services/ijaza/settings');

describe('verification codes', () => {
  test('tokens are long, URL-safe and unique', () => {
    const set = new Set(Array.from({ length: 2000 }, codes.newToken));
    assert.equal(set.size, 2000);
    [...set].forEach(t => assert.ok(codes.isToken(t) && t.length === 22, t));
  });
  test('short codes look like ISN-XXXX-XXXX with readable letters only', () => {
    for (let i = 0; i < 500; i++) assert.match(codes.newShortCode(), /^ISN-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
  });
  test('typed codes are forgiving (case, spaces, O/0, I/L/1) and junk is rejected', () => {
    assert.equal(codes.normalizeShortCode('isn 7k3q 9p2m'), 'ISN-7K3Q-9P2M');
    assert.equal(codes.normalizeShortCode('7K3Q9P2M'), 'ISN-7K3Q-9P2M');
    assert.equal(codes.normalizeShortCode('ISN-OOIL-0000'), 'ISN-0011-0000');
    assert.equal(codes.normalizeShortCode('ISN-123'), null);
    assert.equal(codes.isToken('../../etc'), false);
  });
});

describe('public endpoint', () => {
  const ROW = {
    id: 9, user_id: 3, public_token: 'A'.repeat(22), short_code: 'ISN-7K3Q-9P2M', student_name: 'أحمد', title: 'إجازة',
    module: 'mutoon', style: 'normal', issued_at: '2026-11-08', issued_hijri: '17 جمادى 1448هـ', place: 'فاس', body: 'نص',
    revoked_at: null, revoke_reason: 'سر', scan_count: 4, details: { people: { shaykh: 'الشيخ' }, notes: {}, chains: [] },
  };
  let row = { ...ROW }, scans = 0;
  const modelPath = require.resolve(path.join(__dirname, '../src/models/IjazaModel'));
  const settingsPath = require.resolve(path.join(__dirname, '../src/models/SettingsModel'));
  require.cache[modelPath] = { id: modelPath, filename: modelPath, loaded: true, exports: {
    findByToken: async t => (t === row.public_token ? row : undefined),
    findByShortCode: async c => (c === row.short_code ? row : undefined),
    recordScan: async () => { scans++; },
  } };
  require.cache[settingsPath] = { id: settingsPath, filename: settingsPath, loaded: true, exports: { get: async () => ({ shaykh_name: 'من الإعدادات' }) } };
  const c = require('../src/controllers/publicController');
  const call = async (fn, params, query = {}) => { let body; await fn({ params, query }, { json: b => { body = b; } }); return body; };

  test('valid ijaza: summary + full text, counts the scan, exposes no internal fields', async () => {
    scans = 0;
    const b = await call(c.byToken, { token: ROW.public_token });
    assert.equal(b.status, 'valid');
    assert.equal(b.body, 'نص');
    assert.equal(b.shaykh_name, 'الشيخ');
    assert.equal(b.revoke_reason, null);                       // reason only shown once revoked
    for (const k of ['id', 'user_id', 'public_token', 'scan_count']) assert.ok(!(k in b), k);
    assert.equal(scans, 1);
  });
  test('the owner\'s preview does not count as a scan', async () => {
    scans = 0;
    await call(c.byToken, { token: ROW.public_token }, { preview: '1' });
    assert.equal(scans, 0);
  });
  test('lookup by a typed short code', async () => {
    const b = await call(c.byCode, { code: 'isn 7k3q 9p2m' });
    assert.equal(b.short_code, 'ISN-7K3Q-9P2M');
  });
  test('revoked ijaza shows status and reason', async () => {
    row = { ...ROW, revoked_at: '2026-11-09', revoke_reason: 'خطأ في الاسم' };
    const b = await call(c.byToken, { token: ROW.public_token });
    assert.equal(b.status, 'revoked');
    assert.equal(b.revoke_reason, 'خطأ في الاسم');
    row = { ...ROW };
  });
  test('unknown or malformed codes → 404 / 400', async () => {
    await assert.rejects(call(c.byToken, { token: 'B'.repeat(22) }), e => e.status === 404);
    await assert.rejects(call(c.byToken, { token: '../x' }), e => e.status === 404);
    await assert.rejects(call(c.byCode, { code: 'nope' }), e => e.status === 400);
  });
  test('shaykh name falls back to the ijaza settings of its owner', async () => {
    row = { ...ROW, details: null };
    assert.equal((await call(c.byToken, { token: ROW.public_token })).shaykh_name, 'من الإعدادات');
    row = { ...ROW };
  });
});

test('rate limit: 429 after max requests per window, per IP', () => {
  const mw = rateLimit({ windowMs: 60_000, max: 3 });
  const res = () => { const r = { headers: {} }; r.set = (k, v) => { r.headers[k] = v; }; r.status = s => { r.code = s; return r; }; r.json = b => { r.body = b; return r; }; return r; };
  let passed = 0;
  for (let i = 0; i < 5; i++) mw({ ip: '1.2.3.4' }, res(), () => passed++);
  assert.equal(passed, 3);
  mw({ ip: '5.6.7.8' }, res(), () => passed++);
  assert.equal(passed, 4);
});

test('public base URL is validated and trailing slashes removed', () => {
  assert.equal(IS.validateSettings({ public_base_url: 'http://192.168.1.20:8080/' }).public_base_url, 'http://192.168.1.20:8080');
  assert.equal(IS.validateSettings({ public_base_url: '' }).public_base_url, '');
  assert.throws(() => IS.validateSettings({ public_base_url: 'javascript:alert(1)' }), e => e.status === 400);
});
