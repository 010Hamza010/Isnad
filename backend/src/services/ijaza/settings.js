const DEFAULTS = require('./defaults');
const { HttpError } = require('../../utils/httpError');
const { mergeDesign, validateDesigns, FONTS, FRAMES, FONT_SIZES } = require('./designs');

const MODULES = ['mutoon', 'quran', 'general'];
const MAX_TEMPLATE = 20000;

function mergeSettings(stored) {
  const s = JSON.parse(JSON.stringify(DEFAULTS));
  if (!stored || typeof stored !== 'object') return s;
  if (typeof stored.shaykh_name === 'string') s.shaykh_name = stored.shaykh_name;
  if (typeof stored.place === 'string') s.place = stored.place;
  MODULES.forEach(m => { if (typeof stored.templates?.[m] === 'string') s.templates[m] = stored.templates[m]; });
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
  MODULES.forEach(m => {
    if (!s.templates[m].trim()) throw new HttpError(400, `قالب «${m}» فارغ`);
    if (s.templates[m].length > MAX_TEMPLATE) throw new HttpError(400, `قالب «${m}» طويل جداً`);
  });
  const designs = validateDesigns(s.designs);
  const default_design = designs.some(d => d.id === s.default_design) ? s.default_design : designs[0].id;
  return { shaykh_name: s.shaykh_name.trim(), place: s.place.trim(), templates: s.templates, designs, default_design };
}

// limits the designer UI needs (fonts list, size ranges, frame styles)
const designOptions = () => ({ fonts: FONTS, frames: FRAMES, fontSizes: FONT_SIZES });

module.exports = { mergeSettings, validateSettings, designOptions, MODULES, DEFAULTS };
