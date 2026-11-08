const DEFAULTS = require('./defaults');
const { HttpError } = require('../../utils/httpError');
const { mergeDesign, validateDesigns, FONTS, FRAMES, FONT_SIZES } = require('./designs');

const MODULES = ['mutoon', 'quran', 'general'];
const MAX_TEMPLATE = 20000;

// Upgrade templates saved by an older version (each step runs once):
//  v2: teachers paragraph before «وإسنادي»;  v3: gendered wording of the default fragments
function upgradeTemplates(templates, fromVersion) {
  if (fromVersion < 2) ['mutoon', 'quran'].forEach(m => {
    const t = templates[m];
    if (!t.includes('{شيوخ_القراءة}')) templates[m] = t.replace(/(^|\n\n)(\s*وإسنادي)/, '$1{شيوخ_القراءة}\n\n$2');
  });
  if (fromVersion < 3) MODULES.forEach(m => {
    if (templates[m].includes('{المجاز:')) return;
    templates[m] = DEFAULTS.GENDERED.reduce((t, [masc, gen]) => t.split(masc).join(gen), templates[m]);
  });
}

function mergeSettings(stored) {
  const s = JSON.parse(JSON.stringify(DEFAULTS));
  delete s.GENDERED;
  if (!stored || typeof stored !== 'object') return s;
  if (typeof stored.shaykh_name === 'string') s.shaykh_name = stored.shaykh_name;
  if (typeof stored.place === 'string') s.place = stored.place;
  if (typeof stored.public_base_url === 'string') s.public_base_url = stored.public_base_url;
  if (typeof stored.teachers_title === 'string') s.teachers_title = stored.teachers_title;
  MODULES.forEach(m => { if (typeof stored.templates?.[m] === 'string') s.templates[m] = stored.templates[m]; });
  ['mutoon', 'quran'].forEach(m => {
    if (typeof stored.teachers_sentence?.[m] === 'string') s.teachers_sentence[m] = stored.teachers_sentence[m];
  });
  if ((stored.templates_version || 1) < DEFAULTS.templates_version) upgradeTemplates(s.templates, stored.templates_version || 1);
  if (stored.shaykh_gender === 'F' || stored.shaykh_gender === 'M') s.shaykh_gender = stored.shaykh_gender;
  if (typeof stored.teachers_title_f === 'string') s.teachers_title_f = stored.teachers_title_f;
  if (Array.isArray(stored.designs) && stored.designs.length) s.designs = stored.designs.map(mergeDesign);
  if (typeof stored.default_design === 'string') s.default_design = stored.default_design;
  if (!s.designs.some(d => d.id === s.default_design)) s.default_design = s.designs[0].id;
  return s;
}

function validateSettings(input) {
  if (!input || typeof input !== 'object') throw new HttpError(400, 'الإعدادات غير صالحة');
  const s = mergeSettings(input);
  if (s.shaykh_name.length > 200) throw new HttpError(400, 'اسم المجيز طويل جداً');
  if (s.place.length > 150) throw new HttpError(400, 'المكان طويل جداً');
  const base = s.public_base_url.trim().replace(/\/+$/, '');
  if (base && (base.length > 200 || !/^https?:\/\/[^\s/]+(\/[^\s]*)?$/i.test(base)))
    throw new HttpError(400, 'عنوان التحقق يجب أن يبدأ بـ http:// أو https://');
  s.public_base_url = base;
  if (s.teachers_title.length > 30 || s.teachers_title_f.length > 30) throw new HttpError(400, 'لقب الشيوخ طويل جداً');
  MODULES.forEach(m => {
    if (!s.templates[m].trim()) throw new HttpError(400, `قالب «${m}» فارغ`);
    if (s.templates[m].length > MAX_TEMPLATE) throw new HttpError(400, `قالب «${m}» طويل جداً`);
  });
  ['mutoon', 'quran'].forEach(m => {
    const t = String(s.teachers_sentence[m] ?? '').trim();
    if (t.length > 500) throw new HttpError(400, 'جملة الشيوخ طويلة جداً');
    if (t && !t.includes('{الشيوخ}')) throw new HttpError(400, 'جملة الشيوخ يجب أن تحتوي على {الشيوخ}');
    s.teachers_sentence[m] = t;
  });
  const designs = validateDesigns(s.designs);
  const default_design = designs.some(d => d.id === s.default_design) ? s.default_design : designs[0].id;
  return {
    templates_version: DEFAULTS.templates_version, shaykh_name: s.shaykh_name.trim(), place: s.place.trim(),
    public_base_url: s.public_base_url,
    teachers_title: s.teachers_title.trim(), teachers_title_f: s.teachers_title_f.trim(), shaykh_gender: s.shaykh_gender,
    templates: s.templates, teachers_sentence: s.teachers_sentence, designs, default_design,
  };
}

// limits the designer UI needs (fonts list, size ranges, frame styles)
const designOptions = () => ({ fonts: FONTS, frames: FRAMES, fontSizes: FONT_SIZES });

module.exports = { mergeSettings, validateSettings, designOptions, MODULES, DEFAULTS };
