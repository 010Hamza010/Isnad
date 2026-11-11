const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
process.env.QR_SECRET = 'test-secret';
const Q = require('../src/utils/qrPayload');

const ROW = { id: 5, user_id: 7, short_code: 'ISN-7K3Q-9P2M', student_name: 'أحمد بن علي', title: 'إجازة في متن «الآجرومية»',
  created_at: '2026-11-08T10:32:41Z', issued_at: '2026-11-08', revoked_at: null };

describe('QR payload', () => {
  test('five short lines: code, student, subject (without «إجازة في»), date-time, signature — no URL', () => {
    const p = Q.buildPayload(ROW);
    assert.match(p, /^ISN-7K3Q-9P2M\nأحمد بن علي\nمتن «الآجرومية»\n2026-11-08 10:32\n[\w-]{16}$/);
    assert.doesNotMatch(p, /https?:/);
    assert.ok(Buffer.byteLength(p) < 140, `${Buffer.byteLength(p)} bytes`);
  });
  test('QR codes printed with the first (labelled) format are still verified', () => {
    const crypto = require('crypto');
    const f = { code: ROW.short_code, student: ROW.student_name, subject: ROW.title, issued: '2026-11-08 10:32' };
    const sig = crypto.createHmac('sha256', 'test-secret').update([f.code, f.student, f.subject, f.issued].join('\n')).digest('base64url').slice(0, 22);
    const old = `إجازة — إسناد\nالرمز: ${f.code}\nالمجاز: ${f.student}\nالموضوع: ${f.subject}\nالتاريخ: ${f.issued}\nالتوقيع: ${sig}`;
    const parsed = Q.parsePayload(old);
    assert.equal(parsed.format, 1);
    assert.ok(Q.signatureOk(parsed));
    assert.deepEqual(Q.fieldsForFormat(ROW, 1).subject, ROW.title);
  });
  test('parse → fields, and the signature checks out; any edited field breaks it', () => {
    const f = Q.parsePayload(Q.buildPayload(ROW));
    assert.equal(f.student, 'أحمد بن علي');
    assert.ok(Q.signatureOk(f));
    assert.ok(!Q.signatureOk({ ...f, student: 'محمد بن علي' }));
    assert.ok(!Q.signatureOk({ ...f, sig: 'x' }));
  });
  test('a different secret (another installation) does not validate', () => {
    const f = Q.parsePayload(Q.buildPayload(ROW));
    process.env.QR_SECRET = 'other';
    assert.ok(!Q.signatureOk(f));
    process.env.QR_SECRET = 'test-secret';
  });
  test('non-isnad QR text is not parsed', () => {
    assert.equal(Q.parsePayload('https://example.com'), null);
  });
});

describe('dashboard verification', () => {
  let row = { ...ROW }, scans = 0;
  const modelPath = require.resolve(path.join(__dirname, '../src/models/IjazaModel'));
  require.cache[modelPath] = { id: modelPath, filename: modelPath, loaded: true, exports: {
    findByShortCode: async (code, uid) => (code === row.short_code && uid === row.user_id ? row : undefined),
    recordScan: async () => { scans++; },
  } };
  const c = require('../src/controllers/verifyController');
  const verify = async (body, uid = 7) => { let out; await c.verify({ body, user: { id: uid } }, { json: b => { out = b; } }); return out; };

  test('genuine QR → valid, every check passes, scan counted', async () => {
    scans = 0;
    const r = await verify({ payload: Q.buildPayload(row) });
    assert.equal(r.status, 'valid');
    assert.ok(r.checks.every(x => x.ok));
    assert.equal(scans, 1);
  });
  test('edited student name in the QR → altered, with the differing field', async () => {
    const forged = Q.buildPayload(row).replace('أحمد بن علي', 'محمد بن علي');
    const r = await verify({ payload: forged });
    assert.equal(r.status, 'altered');
    assert.deepEqual(r.checks.filter(x => !x.ok).map(x => x.field).sort(), ['المجاز', 'التوقيع'].sort());
  });
  test('revoked ijaza → revoked', async () => {
    row = { ...ROW, revoked_at: '2026-11-09', revoke_reason: 'خطأ' };
    assert.equal((await verify({ payload: Q.buildPayload(row) })).status, 'revoked');
    row = { ...ROW };
  });
  test('unknown code, someone else\'s ijaza, foreign QR, typed code', async () => {
    assert.equal((await verify({ payload: Q.buildPayload({ ...ROW, short_code: 'ISN-0000-0000' }) })).status, 'unknown');
    assert.equal((await verify({ payload: Q.buildPayload(row) }, 99)).status, 'unknown');
    assert.equal((await verify({ payload: 'hello' })).status, 'invalid');
    const typed = await verify({ code: 'isn 7k3q 9p2m' });
    assert.equal(typed.status, 'valid');
    assert.deepEqual(typed.checks, []);
  });
});

test('a title on several lines signs as one line, exactly like the same title with a space', () => {
  const one = Q.buildPayload({ ...ROW, title: 'إجازة في متن «المنظومة الطويلة»' });
  const two = Q.buildPayload({ ...ROW, title: 'إجازة في متن \n«المنظومة الطويلة»' });
  assert.equal(two, one);
  assert.equal(two.split('\n').length, one.split('\n').length);
});

test('signing refuses an empty key', () => {
  const saved = { qr: process.env.QR_SECRET, jwt: process.env.JWT_SECRET };
  delete process.env.QR_SECRET; delete process.env.JWT_SECRET;
  try {
    assert.throws(() => Q.buildPayload({ short_code: 'ISN-AAAA-BBBB', student_name: 'x', title: 'y', issued_at: '2026-01-01' }), /not set/);
  } finally {
    process.env.QR_SECRET = saved.qr;
    if (saved.jwt !== undefined) process.env.JWT_SECRET = saved.jwt;
  }
});
