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

const D = require('../src/services/ijaza/designs');

test('designs: built-in presets validate, and a partial design is completed from classic', () => {
  assert.doesNotThrow(() => D.validateDesigns(D.PRESETS));
  const [d] = D.validateDesigns([{ id: 'mine', name: 'تصميمي', colors: { student: '#123456' } }]);
  assert.equal(d.colors.student, '#123456');
  assert.equal(d.colors.paper, D.CLASSIC.colors.paper);
  assert.equal(d.fonts.body.family, 'Amiri');
});

test('designs: reject bad colors, fonts, sizes, frames, duplicate ids', () => {
  const bad = patch => () => D.validateDesigns([{ id: 'x', name: 'x', ...patch }]);
  assert.throws(bad({ colors: { student: 'red' } }), e => e.status === 400);
  assert.throws(bad({ fonts: { body: { family: 'Comic Sans', size: 14 } } }), e => e.status === 400);
  assert.throws(bad({ fonts: { body: { family: 'Amiri', size: 90 } } }), e => e.status === 400);
  assert.throws(bad({ frame: { style: 'wavy' } }), e => e.status === 400);
  assert.throws(() => D.validateDesigns([{ id: 'a', name: 'a' }, { id: 'a', name: 'b' }]), /مكرر/);
});

test('settings keep a valid default design', () => {
  const s = IS.validateSettings({ designs: [{ id: 'mine', name: 'م' }], default_design: 'gone' });
  assert.equal(s.default_design, 'mine');
  assert.equal(IS.mergeSettings(null).default_design, 'classic');
});

test('teachers paragraph: defaults contain it, old saved templates are upgraded once', () => {
  assert.match(IS.DEFAULTS.templates.mutoon, /\{شيوخ_القراءة\}\n\nوإسنادي/);
  const old = { templates: { mutoon: 'أما بعد…\n\nوإسنادي فيه: {الإسناد}.', quran: 'نص بلا إسناد', general: 'عامة' } };
  const up = IS.mergeSettings(old);
  assert.equal(up.templates.mutoon, 'أما بعد…\n\n{شيوخ_القراءة}\n\nوإسنادي فيه: {الإسناد}.');
  assert.equal(up.templates.quran, 'نص بلا إسناد'); // nothing to anchor on: unchanged
  // saved after the upgrade (version 2): a removed placeholder stays removed
  const saved = IS.validateSettings(up);
  saved.templates.mutoon = 'أما بعد…\n\nوإسنادي فيه: {الإسناد}.';
  assert.doesNotMatch(IS.mergeSettings(saved).templates.mutoon, /شيوخ_القراءة/);
});

test('teachers sentence must contain {الشيوخ}', () => {
  assert.throws(() => IS.validateSettings({ teachers_sentence: { mutoon: 'قرأت على جماعة' } }), e => e.status === 400);
  assert.doesNotThrow(() => IS.validateSettings({ teachers_sentence: { mutoon: '' } }));
});

test('teachers title defaults to «الشيخ» and is validated', () => {
  assert.equal(IS.mergeSettings(null).teachers_title, 'الشيخ');
  assert.equal(IS.validateSettings({ teachers_title: '  شيخنا ' }).teachers_title, 'شيخنا');
  assert.throws(() => IS.validateSettings({ teachers_title: 'x'.repeat(31) }), e => e.status === 400);
});

test('templates saved before gender support are upgraded once to gendered wording', () => {
  const old = {
    templates_version: 2,
    templates: { mutoon: 'فأجزته به.\n\nوأوصيه بتقوى الله.\n\nوكتبه: {المجيز}', quran: 'فأجزته', general: 'نص خاص' },
  };
  const up = IS.mergeSettings(old);
  assert.equal(up.templates.mutoon, '{المجاز:فأجزته|فأجزتها} به.\n\n{المجاز:وأوصيه|وأوصيها} بتقوى الله.\n\n{المجيز:وكتبه|وكتبته}: {المجيز}');
  assert.equal(up.templates.general, 'نص خاص');
  // already upgraded (version 3): untouched, even if the user wrote «فأجزته» on purpose
  const v3 = { ...IS.validateSettings(up), templates: { ...up.templates, general: 'فأجزته' } };
  assert.equal(IS.mergeSettings(v3).templates.general, 'فأجزته');
});

test('shaykh gender and feminine teacher title default and validate', () => {
  const s = IS.mergeSettings(null);
  assert.equal(s.shaykh_gender, 'M');
  assert.equal(s.teachers_title_f, 'الشيخة');
  assert.equal(IS.validateSettings({ shaykh_gender: 'F' }).shaykh_gender, 'F');
  assert.equal(IS.validateSettings({ shaykh_gender: 'x' }).shaykh_gender, 'M');
  assert.equal(s.GENDERED, undefined); // internal table not exposed
});

test('designs carry a verification QR setting (default shown, 20 mm) and validate its size', () => {
  const [d] = D.validateDesigns([{ id: 'x', name: 'x' }]);
  assert.deepEqual(d.qr, { show: true, sizeMm: 20 });
  // earlier defaults (22, 30) follow the new default; a size chosen by the user stays
  assert.equal(D.validateDesigns([{ id: 'x', name: 'x', qr: { sizeMm: 30 } }])[0].qr.sizeMm, 20);
  assert.equal(D.validateDesigns([{ id: 'x', name: 'x', qr: { sizeMm: 18 } }])[0].qr.sizeMm, 18);
  assert.equal(D.validateDesigns([{ id: 'x', name: 'x', qr: { show: false } }])[0].qr.show, false);
  assert.throws(() => D.validateDesigns([{ id: 'x', name: 'x', qr: { sizeMm: 80 } }]), e => e.status === 400);
});
