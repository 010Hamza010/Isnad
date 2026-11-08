const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const IS = require('../src/services/ijaza/settings');

test('ijaza settings merge partial input over defaults', () => {
  const s = IS.mergeSettings({ shaykh_name: 'فلان', templates: { quran: 'قالب' } });
  assert.equal(s.shaykh_name, 'فلان');
  assert.equal(s.templates.quran, 'قالب');
  assert.match(s.templates.mutoon, /\{الإسناد\}/);
});

test('ijaza settings reject empty templates and trim names', () => {
  assert.throws(() => IS.validateSettings({ templates: { general: '  ' } }), e => e.status === 400);
  assert.equal(IS.validateSettings({ shaykh_name: '  الشيخ  ' }).shaykh_name, 'الشيخ');
});

test('every default template signs with the shaykh and date', () => {
  IS.MODULES.forEach(m => assert.match(IS.DEFAULTS.templates[m], /\{المجيز\}[\s\S]*\{التاريخ_الهجري\}/));
});

// controller validation with a stubbed model
const calls = [];
const modelPath = require.resolve(path.join(__dirname, '../src/models/IjazaModel'));
require.cache[modelPath] = { id: modelPath, filename: modelPath, loaded: true,
  exports: { create: async (uid, f) => { calls.push([uid, f]); return { id: 1, ...f }; } } };
const c = require('../src/controllers/ijazatController');
const res = () => { const r = {}; r.json = b => { r.body = b; return r; }; return r; };
const valid = { student_name: ' أحمد ', module: 'mutoon', matn_id: 3, body: 'نص', issued_at: '2026-11-08' };

test('create validates module, date and matn, and scopes to the user', async () => {
  await assert.rejects(c.create({ user: { id: 7 }, body: { ...valid, module: 'x' } }, res()), e => e.status === 400);
  await assert.rejects(c.create({ user: { id: 7 }, body: { ...valid, issued_at: '8/11/2026' } }, res()), e => e.status === 400);
  await assert.rejects(c.create({ user: { id: 7 }, body: { ...valid, matn_id: null } }, res()), e => e.status === 400);
  const r = res();
  await c.create({ user: { id: 7 }, body: valid }, r);
  assert.equal(calls[0][0], 7);
  assert.equal(r.body.student_name, 'أحمد');
});

test('create stores style and a JSON details snapshot; rejects unknown style', async () => {
  await assert.rejects(c.create({ user: { id: 7 }, body: { ...valid, style: 'fancy' } }, res()), e => e.status === 400);
  calls.length = 0;
  await c.create({ user: { id: 7 }, body: { ...valid, style: 'detailed', details: { notes: { 1: { name: 'أ' } }, chains: [] } } }, res());
  assert.equal(calls[0][1].style, 'detailed');
  assert.equal(typeof calls[0][1].details, 'string');
  calls.length = 0;
  await c.create({ user: { id: 7 }, body: valid }, res());
  assert.equal(calls[0][1].style, 'normal');
  assert.equal(calls[0][1].details, null);
});
