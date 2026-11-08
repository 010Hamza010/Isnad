/**
 * Default ijaza settings. Templates use {placeholders}; the frontend fills them
 * (see frontend/src/utils/ijaza.js for the list of keys).
 */
const OPENING = 'بسم الله الرحمن الرحيم\n\nالحمد لله الذي جعل الإسناد من الدين، وحفظ به هذا الشرع المتين، والصلاة والسلام على سيدنا محمد وعلى آله وصحبه أجمعين.\n\nأما بعد،';
const CLOSING = 'وأوصيه بتقوى الله تعالى في السر والعلن، وبالعمل بما علم، وبنشره بين أهله، وألا ينساني من صالح دعائه في خلواته وجلواته.';
const SIGN = 'وكتبه: {المجيز}\n{المكان}، في {التاريخ_الهجري}، الموافق {التاريخ}';

const { PRESETS } = require('./designs');

module.exports = {
  // 2: templates contain {شيوخ_القراءة}; older stored templates are upgraded once (see settings.js)
  templates_version: 2,
  // the paragraph that lists the shuyukh I read on; only used when there are two or more
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
      `${OPENING} فإن {الطالب} قد {كيفية_الأخذ} متن «{المتن}» للإمام {المؤلف}، وطلب مني الإجازة به، فأجزته به وبجميع ما تجوز لي روايته، بشرطه المعتبر عند أهل الأثر.\n\n{شيوخ_القراءة}\n\nوإسنادي فيه: {الإسناد}.\n\n${CLOSING}\n\n${SIGN}`,
    quran:
      `${OPENING} فإن {الطالب} قد {كيفية_الأخذ} القرآن الكريم كاملاً من أوله إلى آخره {ما_قرئ}، قراءةً متقنةً مجوّدة، وطلب مني الإجازة، فأجزته أن يقرأ ويُقرئ بما قرأ به عليّ، بشرطه المعتبر عند أهل الأداء.\n\n{شيوخ_القراءة}\n\nوإسنادي فيه: {الإسناد}.\n\n${CLOSING}\n\n${SIGN}`,
    general:
      `${OPENING} فقد طلب مني {الطالب} الإجازة، فأجزته إجازةً عامةً بجميع ما تجوز لي روايته من منقول ومعقول، ومسموع ومجاز، بشرطه المعتبر عند أهل الأثر.\n\n${CLOSING}\n\n${SIGN}`,
  },
};
