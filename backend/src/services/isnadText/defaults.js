/**
 * Default isnad-text settings. Users override them in Settings; see validate.js for the shape.
 *
 * keywords — صيغ الأداء. `word` is the full form used when rendering, `abbr` the abbreviated
 *   form (ثنا، أنا…), `variants` are extra spellings recognised when parsing.
 *   `tx_type_id` links to transmission_types (null = عنعنة). `preferred` marks the form
 *   used when rendering that transmission type.
 */
module.exports = {
  keywords: [
    { word: 'حدثنا',     abbr: 'ثنا',  variants: ['نا', 'حدثني'],             tx_type_id: 1,    preferred: true },
    { word: 'سمعت',      abbr: '',     variants: ['سمعنا'],                    tx_type_id: 1,    preferred: false },
    { word: 'أخبرنا',    abbr: 'أنا',  variants: ['أرنا', 'أخبرني'],           tx_type_id: 2,    preferred: true },
    { word: 'قرأت على',  abbr: '',     variants: ['قرأنا على'],                tx_type_id: 2,    preferred: false },
    { word: 'أنبأنا',    abbr: 'أنبا', variants: ['أنبأني'],                   tx_type_id: 3,    preferred: true },
    { word: 'أجازني',    abbr: '',     variants: ['أجازنا', 'أجاز لي', 'أجاز لنا'], tx_type_id: 3, preferred: false },
    { word: 'ناولني',    abbr: '',     variants: ['ناولنا'],                   tx_type_id: 5,    preferred: true },
    { word: 'كتب إلي',   abbr: '',     variants: ['كتب إلينا', 'كاتبني'],      tx_type_id: 6,    preferred: true },
    { word: 'وجدت بخط',  abbr: '',     variants: [],                          tx_type_id: 7,    preferred: true },
    { word: 'عرضت على',  abbr: '',     variants: ['عرضنا على', 'قرأت القرآن على'], tx_type_id: 9, preferred: true },
    { word: 'عن',        abbr: '',     variants: [],                          tx_type_id: null, preferred: true },
  ],
  style: {
    abbreviate: false,   // use ثنا/أنا instead of حدثنا/أخبرنا
    qala: false,         // insert «قال:» before each keyword after the first
    separator: '، ',
    tahwil: 'ح',         // marker between alternative chains
    firstTitle: 'شيخنا', // title before my own shaykh's name ('' to disable)
    clear: false,        // append an explicit phrase per link: «… قرأتُ عليه»، «… سماعاً عليه»
    deathYears: false,   // «فلان (ت 852هـ)»
    noteMarkers: false,  // «فلان[[12]]» after a person's first mention, for margin notes
  },
  // explicit phrases by transmission type id ('null' = untyped / عنعنة).
  // `first` is used for my own link (I speak), `others` for every link above it.
  clear: {
    first: {
      1: 'سمعتُ عليه', 2: 'قرأتُ عليه', 10: 'قراءةً عليه وأنا أسمع', 3: 'إجازةً', 4: 'إجازةً عامة',
      5: 'مناولةً', 6: 'مكاتبةً', 7: 'وجادةً', 8: 'إعلاماً', 9: 'عرضتُ عليه', null: '',
    },
    others: {
      1: 'سماعاً عليه', 2: 'قراءةً عليه', 10: 'قراءةً عليه وهو يسمع', 3: 'إجازةً', 4: 'إجازةً عامة',
      5: 'مناولةً', 6: 'مكاتبةً', 7: 'وجادةً', 8: 'إعلاماً', 9: 'عرضاً عليه', null: '',
    },
  },
  // stripped from the start of a name when parsing
  titles: ['شيخنا', 'شيخي', 'الشيخ', 'الإمام', 'العلامة', 'الحافظ', 'المحدث', 'المسند', 'الفقيه', 'القاضي', 'المقرئ'],
  // stripped anywhere when parsing
  honorifics: ['رحمه الله', 'رحمها الله', 'رحمهما الله', 'رحمهم الله', 'رضي الله عنه', 'رضي الله عنها',
    'رضي الله عنهما', 'رضي الله عنهم', 'عليه السلام', 'صلى الله عليه وسلم', 'حفظه الله', 'نفعنا الله به', 'تعالى'],
  // ignored words between keyword and name (قال، به، إجازة…)
  fillers: ['قال', 'قالا', 'قالوا', 'قالت', 'ثم', 'به', 'بها', 'إجازة', 'سماعا', 'قراءة', 'كتابة'],
};
