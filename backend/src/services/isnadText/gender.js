/**
 * Gender alternations inside sentences and templates:
 *   {الراوي:وهو قرأ|وهي قرأت}  — by the narrator of the link (the student in it)
 *   {الشيخ:أجاز|أجازت}          — by the shaykh named in the link
 *   {المجاز:فأجزته|فأجزتها}     — (ijaza templates) by the student of the ijaza
 * The first form is masculine, the second feminine. Unknown gender → masculine.
 */
const ALT = /\{([^{}:|\n]{1,20}):([^{}|\n]*)\|([^{}|\n]*)\}/g;
const ROLES = ['الراوي', 'الشيخ', 'المجاز'];

const applyGender = (text, genders = {}) =>
  String(text ?? '').replace(ALT, (whole, role, m, f) => (ROLES.includes(role) ? (genders[role] === 'F' ? f : m) : whole));

/** Every gendered variant of a template (for the parser to recognise them all). */
function expandGender(text) {
  const roles = [...new Set([...String(text).matchAll(ALT)].map(m => m[1]))];
  const combos = roles.reduce((acc, r) => acc.flatMap(g => [{ ...g, [r]: 'M' }, { ...g, [r]: 'F' }]), [{}]);
  return [...new Set(combos.map(g => applyGender(text, g)))];
}

/** Remove alternations (for validation of the rest of the template). */
const stripAlternations = text => String(text ?? '').replace(ALT, '');

module.exports = { applyGender, expandGender, stripAlternations, ROLES };
