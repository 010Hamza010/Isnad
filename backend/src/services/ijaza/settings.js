const DEFAULTS = require('./defaults');
const { HttpError } = require('../../utils/httpError');

const MODULES = ['mutoon', 'quran', 'general'];
const MAX_TEMPLATE = 20000;

function mergeSettings(stored) {
  const s = JSON.parse(JSON.stringify(DEFAULTS));
  if (!stored || typeof stored !== 'object') return s;
  if (typeof stored.shaykh_name === 'string') s.shaykh_name = stored.shaykh_name;
  if (typeof stored.place === 'string') s.place = stored.place;
  MODULES.forEach(m => { if (typeof stored.templates?.[m] === 'string') s.templates[m] = stored.templates[m]; });
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
  return { shaykh_name: s.shaykh_name.trim(), place: s.place.trim(), templates: s.templates };
}

module.exports = { mergeSettings, validateSettings, MODULES, DEFAULTS };
