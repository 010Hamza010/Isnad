/**
 * Ijaza designs (presets): colors per element, fonts, frame/page and tree colors.
 * A stored design is merged over CLASSIC, so new fields get defaults automatically.
 */
const { HttpError } = require('../../utils/httpError');

const FONTS = ['Amiri', 'IBM Plex Sans Arabic', 'Noto Naskh Arabic', 'Scheherazade New', 'Aref Ruqaa', 'Reem Kufi', 'Lateef'];
const FRAMES = ['double', 'single', 'none'];

// [min, max] in pt
const FONT_SIZES = { title: [16, 60], body: [10, 26], notes: [7, 14], tree: [6, 14] };

const CLASSIC = {
  id: 'classic',
  name: 'كلاسيكي',
  colors: {
    paper: '#fffdf6', text: '#1f2a2a', title: '#a87a22', ornament: '#a87a22',
    frame: '#a87a22', frameInner: '#e9d9b0',
    student: '#0f5e5c', shaykh: '#0f5e5c', names: '#5b3a12', sacred: '#a87a22',
    death: '#7a7974', tahwil: '#b42318', noteRef: '#a87a22', noteText: '#3d3d35', rule: '#a87a22',
    treeLine: '#b9a77a', treeNode: '#fffdf6', treeNodeBorder: '#cbbf9f', treeText: '#1f2a2a',
    treeMe: '#0f5e5c', treeSource: '#f7edd6', treeJoin: '#b42318',
    txSama: '#0f5e5c', txQiraa: '#1f5f99', txIjaza: '#6b4aa6', txArd: '#a87a22', txOther: '#9a9a90',
  },
  fonts: {
    title: { family: 'Amiri', size: 30 },
    body:  { family: 'Amiri', size: 15 },
    notes: { family: 'IBM Plex Sans Arabic', size: 8.5 },
    tree:  { family: 'Amiri', size: 9 },
  },
  frame: { style: 'double', ornament: '❁ ❁ ❁', marginMm: 9, paddingMm: 18 },
  boldNames: true,
  qr: { show: true, sizeMm: 30 }, // QR after the signature; it carries ~300 bytes of data, so keep it ≥ 28 mm
};

const SIMPLE = {
  ...CLASSIC, id: 'simple', name: 'بسيط',
  colors: {
    ...CLASSIC.colors, title: '#111111', ornament: '#555555', frame: '#333333', frameInner: '#bbbbbb',
    student: '#111111', shaykh: '#111111', names: '#222222', sacred: '#111111', death: '#666666',
    noteRef: '#333333', rule: '#999999', treeLine: '#999999', treeSource: '#eeeeee', treeMe: '#333333',
  },
  fonts: { ...CLASSIC.fonts, title: { family: 'Noto Naskh Arabic', size: 26 }, body: { family: 'Noto Naskh Arabic', size: 13 } },
  frame: { style: 'single', ornament: '', marginMm: 10, paddingMm: 16 },
};

const MANUSCRIPT = {
  ...CLASSIC, id: 'manuscript', name: 'مخطوط',
  colors: {
    ...CLASSIC.colors, paper: '#f6ecd6', text: '#2b1d0e', title: '#8b1a14', ornament: '#8b1a14',
    frame: '#6b4a1e', frameInner: '#c9a96a', student: '#1d4d2b', shaykh: '#1d4d2b', names: '#2b1d0e',
    sacred: '#8b1a14', death: '#7a5a32', tahwil: '#c0261b', noteRef: '#8b1a14', rule: '#6b4a1e',
    treeNode: '#fbf3e1', treeSource: '#eedbb0', treeMe: '#1d4d2b', treeLine: '#a08355',
  },
  fonts: { ...CLASSIC.fonts, title: { family: 'Aref Ruqaa', size: 34 }, body: { family: 'Scheherazade New', size: 16 } },
  frame: { style: 'double', ornament: '۞', marginMm: 8, paddingMm: 20 },
};

const PRESETS = [CLASSIC, SIMPLE, MANUSCRIPT];
const COLOR = /^#[0-9a-f]{6}$/i;
const clone = o => JSON.parse(JSON.stringify(o));

/** Fill a (possibly partial) design from CLASSIC. */
function mergeDesign(d) {
  const base = clone(CLASSIC);
  if (!d || typeof d !== 'object') return base;
  return {
    id: typeof d.id === 'string' ? d.id : base.id,
    name: typeof d.name === 'string' ? d.name : base.name,
    colors: { ...base.colors, ...(d.colors || {}) },
    fonts: Object.fromEntries(Object.keys(base.fonts).map(k => [k, { ...base.fonts[k], ...(d.fonts?.[k] || {}) }])),
    frame: { ...base.frame, ...(d.frame || {}) },
    boldNames: d.boldNames ?? base.boldNames,
    qr: { ...base.qr, ...(d.qr || {}) },
  };
}

function validateDesign(input, i) {
  const d = mergeDesign(input);
  const f = `designs[${i}]`;
  if (!/^[a-z0-9-]{1,40}$/.test(d.id)) throw new HttpError(400, `${f}: معرّف غير صالح`);
  d.name = String(d.name).trim();
  if (!d.name || d.name.length > 40) throw new HttpError(400, `${f}: الاسم مطلوب (40 حرفاً على الأكثر)`);
  Object.entries(d.colors).forEach(([k, v]) => {
    if (!(k in CLASSIC.colors)) delete d.colors[k];
    else if (!COLOR.test(v)) throw new HttpError(400, `${f}: لون غير صالح (${k})`);
  });
  Object.entries(d.fonts).forEach(([k, v]) => {
    if (!FONTS.includes(v.family)) throw new HttpError(400, `${f}: خط غير متاح (${v.family})`);
    const [min, max] = FONT_SIZES[k];
    const size = Number(v.size);
    if (!(size >= min && size <= max)) throw new HttpError(400, `${f}: حجم الخط ${k} بين ${min} و${max}`);
    d.fonts[k] = { family: v.family, size };
  });
  if (!FRAMES.includes(d.frame.style)) throw new HttpError(400, `${f}: نوع الإطار غير صالح`);
  d.frame.ornament = String(d.frame.ornament ?? '').slice(0, 20);
  const margin = Number(d.frame.marginMm), padding = Number(d.frame.paddingMm);
  if (!(margin >= 0 && margin <= 30) || !(padding >= 6 && padding <= 40)) throw new HttpError(400, `${f}: هوامش الصفحة خارج الحدود`);
  d.frame.marginMm = margin; d.frame.paddingMm = padding;
  d.boldNames = !!d.boldNames;
  const qrSize = Number(d.qr.sizeMm);
  if (!(qrSize >= 14 && qrSize <= 40)) throw new HttpError(400, `${f}: حجم رمز QR بين 14 و40 مم`);
  d.qr = { show: d.qr.show !== false, sizeMm: qrSize };
  return d;
}

function validateDesigns(list) {
  if (!Array.isArray(list) || !list.length || list.length > 12) throw new HttpError(400, 'التصاميم: من 1 إلى 12');
  const out = list.map(validateDesign);
  const ids = new Set();
  out.forEach(d => { if (ids.has(d.id)) throw new HttpError(400, `معرّف مكرر: ${d.id}`); ids.add(d.id); });
  return out;
}

module.exports = { PRESETS, CLASSIC, FONTS, FRAMES, FONT_SIZES, mergeDesign, validateDesigns };
