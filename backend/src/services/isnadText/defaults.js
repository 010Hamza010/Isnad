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
    clear: false,        // write each link as a clear sentence (see `phrases`) instead of a keyword
    deathYears: false,   // «فلان (ت 852هـ)»
    noteMarkers: false,  // «فلان[[12]]» after a person's first mention, for footnotes
    heartWord: 'غيباً من حفظي', // written after the shaykh when I read from memory (clear mode)
    lookingWord: 'نظراً',   // … when I read from the text
  },
  /*
   * Clear sentences per transmission type id ('null' = untyped / عنعنة); {الاسم} is the shaykh.
   * `first` is my own link (I speak), `others` every link above it («وهو …» = the previous shaykh).
   * An empty phrase falls back to the keyword form for that type.
   */
  phrases: {
    first: {
      1: 'سمعتُ من {الاسم}', 2: 'قرأتُ على {الاسم}', 10: 'قُرئ على {الاسم} وأنا أسمع',
      3: 'أجازني {الاسم}', 4: 'أجازني {الاسم} إجازةً عامة', 5: 'ناولني {الاسم}', 6: 'كتب إليّ {الاسم}',
      7: 'وجدتُ بخط {الاسم}', 8: 'أعلمني {الاسم}', 9: 'عرضتُ على {الاسم}', null: 'رويتُ عن {الاسم}',
    },
    others: {
      1: 'وهو سمع من {الاسم}', 2: 'وهو قرأ على {الاسم}', 10: 'وهو قُرئ على {الاسم} وهو يسمع',
      3: 'وهو أجازه {الاسم}', 4: 'وهو أجازه {الاسم} إجازةً عامة', 5: 'وهو ناوله {الاسم}', 6: 'وهو كتب إليه {الاسم}',
      7: 'وهو وجد بخط {الاسم}', 8: 'وهو أعلمه {الاسم}', 9: 'وهو عرض على {الاسم}', null: 'وهو يروي عن {الاسم}',
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
