/**
 * The user's profile: personal settings shared by every feature.
 *   full_name  — signs ijazat («وكتبه: …»)
 *   short_name — the isnad tree and other short mentions
 *   gender     — my own gender (المجيز / «أنا» in sentences)
 *   place      — default place of issue
 * Until the profile is saved once, values come from where they used to live
 * (ijaza settings: shaykh_name / shaykh_gender / place; isnad settings: style.myGender).
 */
const { HttpError } = require('../utils/httpError');

const DEFAULTS = { full_name: '', short_name: '', gender: 'M', place: '' };

function mergeProfile(stored, { ijaza, isnad } = {}) {
  if (stored && typeof stored === 'object') return { ...DEFAULTS, ...stored };
  return {
    full_name: ijaza?.shaykh_name || '',
    short_name: '',
    gender: (ijaza?.shaykh_gender || isnad?.style?.myGender) === 'F' ? 'F' : 'M',
    place: ijaza?.place || '',
  };
}

const text = (v, max, label) => {
  const s = String(v ?? '').trim();
  if (s.length > max) throw new HttpError(400, `${label} طويل جداً`);
  return s;
};

function validateProfile(input) {
  if (!input || typeof input !== 'object') throw new HttpError(400, 'بيانات غير صالحة');
  return {
    full_name: text(input.full_name, 200, 'الاسم الكامل'),
    short_name: text(input.short_name, 60, 'الاسم المختصر'),
    gender: input.gender === 'F' ? 'F' : 'M',
    place: text(input.place, 150, 'المكان'),
  };
}

/** Name for short mentions (tree): the short name, else the full name. */
const shortName = p => p.short_name || p.full_name || '';

module.exports = { DEFAULTS, mergeProfile, validateProfile, shortName };
