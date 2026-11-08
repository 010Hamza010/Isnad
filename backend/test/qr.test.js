const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
process.env.QR_SECRET = 'test-secret';
const Q = require('../src/utils/qrPayload');

const ROW = { id: 5, user_id: 7, short_code: 'ISN-7K3Q-9P2M', student_name: 'أحمد بن علي', title: 'إجازة في متن «الآجرومية»',
  created_at: '2026-11-08T10:32:41Z', issued_at: '2026-11-08', revoked_at: null };

describe('QR payload', () => {
  test('readable lines with code, student, subject, date-time and a signature — no URL', () => {
    const p = Q.buildPayload(ROW);
    assert.match(p, /^إجازة — إسناد\nالرمز: ISN-7K3Q-9P2M\nالمجاز: أحمد بن علي\nالموضوع: إجازة في متن «الآجرومية»\nالتاريخ: 2026-11-08 10:32\nالتوقيع: [\w-]{22}$/);
    assert.doesNotMatch(p, /https?:|\/v\//);
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
