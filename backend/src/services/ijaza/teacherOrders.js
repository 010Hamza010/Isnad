/**
 * The order of my teachers per matn / Quran riwaya, chosen in the ijaza form and reused.
 * Stored as { [key]: [personId, …] } with key «m:<matnId>» or «q:<quran option key>»;
 * «<key>.hidden» lists the teachers left out of the teachers paragraph.
 */
const { HttpError } = require('../../utils/httpError');

const KEY_RE = /^(?:m|q):[\w-]{1,60}(?:\.hidden)?$/;
const MAX_KEYS = 500;
const MAX_IDS = 200;

/** Validate one order; returns the clean list of ids (unique, in order). */
function validateOrder(key, ids) {
  if (!KEY_RE.test(String(key))) throw new HttpError(400, 'مفتاح الترتيب غير صالح');
  if (!Array.isArray(ids) || ids.length > MAX_IDS) throw new HttpError(400, 'قائمة الشيوخ غير صالحة');
  const out = [];
  ids.forEach(v => {
    const n = Number(v);
    if (!Number.isInteger(n)) throw new HttpError(400, 'معرّف غير صالح');
    if (!out.includes(n)) out.push(n);
  });
  return out;
}

/** Stored orders with one key replaced (an empty list removes it). */
function setOrder(stored, key, ids) {
  const orders = stored && typeof stored === 'object' && !Array.isArray(stored) ? { ...stored } : {};
  delete orders[key];
  if (ids.length) {
    if (Object.keys(orders).length >= MAX_KEYS) throw new HttpError(400, 'عدد كبير جداً من الترتيبات');
    orders[key] = ids;
  }
  return orders;
}

module.exports = { validateOrder, setOrder, KEY_RE };
