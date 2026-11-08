/**
 * Default ijaza settings. Templates use {placeholders}; the frontend fills them
 * (see frontend/src/utils/ijaza.js for the list of keys).
 */
const OPENING = 'بسم الله الرحمن الرحيم\n\nالحمد لله الذي جعل الإسناد من الدين، وحفظ به هذا الشرع المتين، والصلاة والسلام على سيدنا محمد وعلى آله وصحبه أجمعين.\n\nأما بعد،';
const CLOSING = 'وأوصيه بتقوى الله تعالى في السر والعلن، وبالعمل بما علم، وبنشره بين أهله، وألا ينساني من صالح دعائه في خلواته وجلواته.';
const SIGN = 'وكتبه: {المجيز}\n{المكان}، في {التاريخ_الهجري}، الموافق {التاريخ}';

const { PRESETS } = require('./designs');

/**
 * Masculine fragments of the original templates → gendered forms.
 * {المجاز:m|f} follows the student's gender, {المجيز:m|f} mine.
 * Used to build the defaults below and to upgrade templates saved before gender support.
 */
const GENDERED = [
  ['فقد طلب مني {الطالب}', 'فقد {المجاز:طلب|طلبت} مني {الطالب}'],
  ['وطلب مني الإجازة', '{المجاز:وطلب|وطلبت} مني الإجازة'],
  ['فأجزته', '{المجاز:فأجزته|فأجزتها}'],
  ['أن يقرأ ويُقرئ بما قرأ به عليّ', '{المجاز:أن يقرأ ويُقرئ بما قرأ|أن تقرأ وتُقرئ بما قرأت} به عليّ'],
  ['وأوصيه', '{المجاز:وأوصيه|وأوصيها}'],
  ['وبالعمل بما علم', '{المجاز:وبالعمل بما علم|وبالعمل بما علمت}'],
  ['وألا ينساني من صالح دعائه في خلواته وجلواته', '{المجاز:وألا ينساني من صالح دعائه في خلواته وجلواته|وألا تنساني من صالح دعائها في خلواتها وجلواتها}'],
  ['وكتبه: {المجيز}', '{المجيز:وكتبه|وكتبته}: {المجيز}'],
];
const gendered = t => GENDERED.reduce((acc, [m, g]) => acc.split(m).join(g), t);

module.exports = {
  GENDERED,
  // 2: templates contain {شيوخ_القراءة}; 3: gendered wording. Older stored templates are upgraded once.
  templates_version: 3,
  shaykh_gender: 'M',          // my gender: {المجيز:…|…} and «وكتبه / وكتبته»
  teachers_title_f: 'الشيخة',  // before a woman's name in the teachers paragraph
  // the paragraph that lists the shuyukh I read on; only used when there are two or more
  teachers_title: 'الشيخ', // before each name in the teachers paragraph
  teachers_sentence: {
    mutoon: 'وقد قرأتُ هذا المتن على جماعة من شيوخي، منهم: {الشيوخ}.',
    quran: 'وقد قرأتُ القرآن الكريم على جماعة من شيوخي، منهم: {الشيوخ}.',
  },
  designs: PRESETS,
  default_design: 'classic',
  shaykh_name: '',
  place: '',
  templates: {
    mutoon:
      gendered(`${OPENING} فإن {الطالب} قد {كيفية_الأخذ} متن «{المتن}» للإمام {المؤلف}، وطلب مني الإجازة به، فأجزته به وبجميع ما تجوز لي روايته، بشرطه المعتبر عند أهل الأثر.\n\n{شيوخ_القراءة}\n\nوإسنادي فيه: {الإسناد}.\n\n${CLOSING}\n\n${SIGN}`),
    quran:
      gendered(`${OPENING} فإن {الطالب} قد {كيفية_الأخذ} القرآن الكريم كاملاً من أوله إلى آخره {ما_قرئ}، قراءةً متقنةً مجوّدة، وطلب مني الإجازة، فأجزته أن يقرأ ويُقرئ بما قرأ به عليّ، بشرطه المعتبر عند أهل الأداء.\n\n{شيوخ_القراءة}\n\nوإسنادي فيه: {الإسناد}.\n\n${CLOSING}\n\n${SIGN}`),
    general:
      gendered(`${OPENING} فقد طلب مني {الطالب} الإجازة، فأجزته إجازةً عامةً بجميع ما تجوز لي روايته من منقول ومعقول، ومسموع ومجاز، بشرطه المعتبر عند أهل الأثر.\n\n${CLOSING}\n\n${SIGN}`),
  },
};
