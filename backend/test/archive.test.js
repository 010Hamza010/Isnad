const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const crypto = require('crypto');

// in-memory stand-in for IjazaModel
const db = { rows: new Map(), pdfs: new Map(), created: [] };
const reset = () => {
  db.rows = new Map([[1, { id: 1, user_id: 7, public_token: 'T'.repeat(22), short_code: 'ISN-AAAA-AAAA', replaced_by_code: null }],
                     [2, { id: 2, user_id: 7, public_token: 'U'.repeat(22), short_code: 'ISN-BBBB-BBBB', replaced_by_code: 'ISN-CCCC-CCCC' }]]);
  db.pdfs = new Map(); db.docs = new Map(); db.created = [];
};
const modelPath = require.resolve(path.join(__dirname, '../src/models/IjazaModel'));
require.cache[modelPath] = { id: modelPath, filename: modelPath, loaded: true, exports: {
  findById: async (id, uid) => { const r = db.rows.get(Number(id)); return r && r.user_id === uid ? r : undefined; },
  VARIANTS: ['normal', 'detailed'],
  freeze: async (id, uid, html, hash, v = 'normal') => { const k = `${id}:${v}`; if (db.docs.has(k)) return false; db.docs.set(k, { html, hash }); return true; },
  savePdf: async (id, meta, v = 'normal') => { const k = `${id}:${v}`; if (db.pdfs.has(k)) return false; db.pdfs.set(k, meta); return true; },
  pdfById: async (id, uid, v = 'normal') => (db.rows.get(Number(id))?.user_id === uid ? db.pdfs.get(`${id}:${v}`) : undefined),
  create: async (uid, f) => { db.created.push(f); return { id: 3, ...f }; },
} };
const c = require('../src/controllers/ijazatController');

const res = () => { const r = { headers: {} }; r.json = b => { r.body = b; return r; }; r.set = h => { Object.assign(r.headers, h); return r; }; r.send = b => { r.sent = b; return r; }; return r; };
const req = (id, body, extra = {}) => ({ user: { id: 7 }, params: { id }, body, query: {}, get: () => undefined, ...extra });
const DOC = '<!doctype html><html><body><div class="cert-page">نص</div></body></html>';

describe('freezing the issued document', () => {
  test('stores once with its SHA-256; a second freeze is refused', async () => {
    reset();
    const r = res();
    await c.freeze(req(1, { html: DOC }), r);
    assert.equal(r.body.content_hash, crypto.createHash('sha256').update(DOC).digest('hex'));
    await assert.rejects(c.freeze(req(1, { html: DOC.replace('نص', 'نص معدّل') }), res()), e => e.status === 409);
    assert.equal(db.docs.get('1:normal').html, DOC);
  });
  test('rejects non-documents and active content; other users\' ijazat are not found', async () => {
    reset();
    await assert.rejects(c.freeze(req(1, { html: '<div>x</div>' }), res()), e => e.status === 400);
    await assert.rejects(c.freeze(req(1, { html: DOC.replace('</body>', '<script>alert(1)</script></body>') }), res()), e => e.status === 400);
    await assert.rejects(c.freeze(req(1, { html: DOC }, { user: { id: 99 } }), res()), e => e.status === 404);
  });
});

test('issued ijazat cannot be deleted', async () => {
  await assert.rejects(c.remove(req(1)), e => e.status === 409);
});

describe('delivered PDF', () => {
  const pdf = Buffer.from('%PDF-1.7\n…binary…');
  test('accepted once, with size and SHA-256; a non-PDF is refused', async () => {
    reset();
    const r = res();
    await c.uploadPdf(req(1, pdf, { get: h => (h === 'X-Filename' ? encodeURIComponent('إجازة أحمد.pdf') : undefined) }), r);
    assert.equal(r.body.pdf_size, pdf.length);
    assert.equal(r.body.pdf_sha256, crypto.createHash('sha256').update(pdf).digest('hex'));
    assert.equal(r.body.pdf_filename, 'إجازة أحمد.pdf');
    await assert.rejects(c.uploadPdf(req(1, pdf), res()), e => e.status === 409);
    await assert.rejects(c.uploadPdf(req(1, Buffer.from('<html>')), res()), e => e.status === 400);
  });
  test('download sends the stored bytes with a download filename and fingerprint', async () => {
    const r = res();
    await c.pdf(req(1), r);
    assert.deepEqual(r.sent, pdf);
    assert.equal(r.headers['Content-Type'], 'application/pdf');
    assert.match(r.headers['Content-Disposition'], /^attachment; filename\*=UTF-8''/);
    assert.equal(r.headers['X-Content-SHA256'], crypto.createHash('sha256').update(pdf).digest('hex'));
  });
});

describe('corrections', () => {
  const base = { student_name: 'أحمد', module: 'mutoon', matn_id: 3, body: 'نص', issued_at: '2026-11-08' };
  test('a correction links to the replaced ijaza and carries the reason', async () => {
    reset();
    await c.create(req(null, { ...base, replaces_id: 1, correction_reason: 'خطأ في الاسم' }), res());
    assert.equal(db.created[0].replaces_id, 1);
    assert.equal(db.created[0].replaces_reason, 'خطأ في الاسم');
  });
  test('cannot correct an ijaza that was already corrected, or one that is not yours', async () => {
    reset();
    await assert.rejects(c.create(req(null, { ...base, replaces_id: 2 }), res()), e => e.status === 409);
    await assert.rejects(c.create(req(null, { ...base, replaces_id: 1 }, { user: { id: 99 } }), res()), e => e.status === 404);
  });
});

test('the two versions are frozen and get their PDF separately, each only once', async () => {
  reset();
  await c.freeze(req(1, { html: DOC }), res());
  const r = res();
  await c.freeze(req(1, { html: DOC.replace('نص', 'مفصّل'), variant: 'detailed' }), r);
  assert.ok(r.body.content_hash);
  await assert.rejects(c.freeze(req(1, { html: DOC, variant: 'detailed' }), res()), e => e.status === 409);
  const pdf = Buffer.from('%PDF-1.7 x');
  const up = res();
  await c.uploadPdf(req(1, pdf, { query: { variant: 'detailed' } }), up);
  assert.ok(up.body.pdf_detailed_sha256);
  await c.uploadPdf(req(1, pdf, { query: {} }), res());           // normal PDF is separate
  await assert.rejects(c.uploadPdf(req(1, pdf, { query: { variant: 'detailed' } }), res()), e => e.status === 409);
});
