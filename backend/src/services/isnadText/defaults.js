/**
 * Default isnad-text settings. Users override them in Settings; see settings.js for the shape.
 * Everything is keyed by transmission *kind* (see ../txKinds.js), never by a type id.
 *
 * keywords — صيغ الأداء. `word` is the full form used when rendering, `abbr` the abbreviated
 *   form (ثنا، أنا…), `variants` are extra spellings recognised when parsing.
 *   `kind` is the transmission kind (null = عنعنة). `preferred` marks the form used when
 *   rendering that kind.
 */
module.exports = {
  keywords: [
    { word: 'حدثنا',     abbr: 'ثنا',  variants: ['نا', 'حدثني'],                   kind: 'lafz',     preferred: true },
    // «سماع» has no keyword of its own: it borrows «حدثنا» (see KIND_FALLBACK in render.js)
    { word: 'سمعت',      abbr: '',     variants: ['سمعنا'],                          kind: 'lafz',     preferred: false },
    { word: 'أخبرنا',    abbr: 'أنا',  variants: ['أرنا', 'أخبرني'],                 kind: 'qiraa',    preferred: true },
    { word: 'قرأت على',  abbr: '',     variants: ['قرأنا على'],                      kind: 'qiraa',    preferred: false },
    { word: 'أنبأنا',    abbr: 'أنبا', variants: ['أنبأني'],                         kind: 'ijaza',    preferred: true },
    { word: 'أجازني',    abbr: '',     variants: ['أجازنا', 'أجاز لي', 'أجاز لنا'],    kind: 'ijaza',    preferred: false },
    { word: 'ناولني',    abbr: '',     variants: ['ناولنا'],                         kind: 'munawala', preferred: true },
    { word: 'كتب إلي',   abbr: '',     variants: ['كتب إلينا', 'كاتبني'],            kind: 'kitaba',   preferred: true },
    { word: 'وجدت بخط',  abbr: '',     variants: [],                                kind: 'wijada',   preferred: true },
    { word: 'عرضت على',  abbr: '',     variants: ['عرضنا على', 'قرأت القرآن على'],    kind: 'ard',      preferred: true },
    { word: 'عن',        abbr: '',     variants: [],                                kind: null,       preferred: true },
  ],
  style: {
    abbreviate: false,   // use ثنا/أنا instead of حدثنا/أخبرنا
    qala: false,         // insert «قال:» before each keyword after the first
    separator: '، ',
    tahwil: 'ح',         // marker between alternative chains
    firstTitle: 'شيخنا', // title before my own shaykh's name ('' to disable)
    firstTitleF: 'شيختنا', // … when she is a woman
    myGender: 'M',       // my gender, for {الراوي:…} in my own sentences
    clear: false,        // write each link as a clear sentence (see `phrases`) instead of a keyword
    deathYears: false,   // «فلان (ت 852هـ)»
    noteMarkers: false,  // «فلان[[12]]» after a person's first mention, for footnotes
    heartWord: 'غيباً من حفظي', // written after the shaykh when I read from memory (clear mode)
    lookingWord: 'نظراً',   // … when I read from the text
    tahwilMeet: 'repeat', // after ح: 'repeat' names the meeting person in every branch, 'joined' writes «كلاهما عن …»
    authorTitle: 'المؤلف', // before the matn's author at the end of the isnad: «عن المؤلف فلان» ('' to disable)
    fullNames: false,    // «أبو عبد الله محمد بن إسماعيل البخاري»: kunya (in case) + nisba — the detailed ijaza
    hideMyReadingMode: false, // omit it on my own link (the ijaza sets this when the teachers paragraph already says it)
  },
  /*
   * Clear sentences per transmission kind ('null' = untyped / عنعنة); {الاسم} is the shaykh.
   * `first` is my own link (I speak), `others` every link above it («وهو …» = the previous shaykh),
   * `joined` follows «كلاهما / كلهم» when every narrator meeting there took the same way.
   * Gender: {الراوي:m|f} follows the narrator of the link, {الشيخ:m|f} the shaykh named in it.
   * An empty sentence falls back to the keyword form for that kind.
   */
  phrases: {
    first: {
      lafz: 'سمعتُ من لفظ {الاسم}', sama: 'سمعتُ من {الاسم}', qiraa: 'قرأتُ على {الاسم}', ard: 'عرضتُ على {الاسم}',
      sama_reading: 'قُرئ على {الاسم} وأنا أسمع',
      munawala: '{الشيخ:ناولني|ناولتني} {الاسم}', ijaza: '{الشيخ:أجازني|أجازتني} {الاسم}',
      kitaba: '{الشيخ:كتب|كتبت} إليّ {الاسم}', ijaza_general: '{الشيخ:أجازني|أجازتني} {الاسم} إجازةً عامة',
      ilam: '{الشيخ:أعلمني|أعلمتني} {الاسم}', wasiyya: '{الشيخ:أوصى|أوصت} لي {الاسم}', wijada: 'وجدتُ بخط {الاسم}',
      null: 'عن {الاسم}',
    },
    others: {
      lafz: '{الراوي:وهو سمع|وهي سمعت} من لفظ {الاسم}', sama: '{الراوي:وهو سمع|وهي سمعت} من {الاسم}',
      qiraa: '{الراوي:وهو قرأ|وهي قرأت} على {الاسم}', ard: '{الراوي:وهو عرض|وهي عرضت} على {الاسم}',
      sama_reading: '{الراوي:وهو|وهي} قُرئ على {الاسم} {الراوي:وهو يسمع|وهي تسمع}',
      munawala: '{الراوي:وهو|وهي} {الشيخ:ناول|ناولت}{الراوي:ه|ها} {الاسم}',
      ijaza: '{الراوي:وهو|وهي} {الشيخ:أجاز|أجازت}{الراوي:ه|ها} {الاسم}',
      kitaba: '{الراوي:وهو|وهي} {الشيخ:كتب|كتبت} {الراوي:إليه|إليها} {الاسم}',
      ijaza_general: '{الراوي:وهو|وهي} {الشيخ:أجاز|أجازت}{الراوي:ه|ها} {الاسم} إجازةً عامة',
      ilam: '{الراوي:وهو|وهي} {الشيخ:أعلم|أعلمت}{الراوي:ه|ها} {الاسم}',
      wasiyya: '{الراوي:وهو|وهي} {الشيخ:أوصى|أوصت} {الراوي:له|لها} {الاسم}',
      wijada: '{الراوي:وهو وجد|وهي وجدت} بخط {الاسم}',
      null: 'عن {الاسم}',
    },
    joined: {
      lafz: '{الراوي:سمع|سمعت} من لفظ {الاسم}', sama: '{الراوي:سمع|سمعت} من {الاسم}',
      qiraa: '{الراوي:قرأ|قرأت} على {الاسم}', ard: '{الراوي:عرض|عرضت} على {الاسم}',
    },
    // a branch after ح that starts from someone already named ({الراوي}): «ح وقرأ شيخنا فلان أيضاً على …»
    also: {
      lafz: '{الراوي:سمع|سمعت} {الراوي} أيضاً من لفظ {الاسم}', sama: '{الراوي:سمع|سمعت} {الراوي} أيضاً من {الاسم}',
      qiraa: '{الراوي:قرأ|قرأت} {الراوي} أيضاً على {الاسم}', ard: '{الراوي:عرض|عرضت} {الراوي} أيضاً على {الاسم}',
      sama_reading: 'قُرئ على {الاسم} أيضاً و{الراوي} {الراوي:يسمع|تسمع}',
      ijaza: '{الشيخ:أجاز|أجازت} {الاسم} {الراوي} أيضاً',
      null: '{الراوي:رواه|روته} {الراوي} أيضاً عن {الاسم}',
    },
  },
  // stripped from the start of a name when parsing
  titles: ['شيخنا', 'شيخي', 'الشيخ', 'شيختنا', 'شيختي', 'الشيخة', 'الإمام', 'العلامة', 'الحافظ', 'المحدث', 'المحدثة',
    'المسند', 'المسندة', 'الفقيه', 'الفقيهة', 'القاضي', 'المقرئ', 'المقرئة', 'السيدة'],
  // stripped anywhere when parsing
  honorifics: ['رحمه الله', 'رحمها الله', 'رحمهما الله', 'رحمهم الله', 'رضي الله عنه', 'رضي الله عنها',
    'رضي الله عنهما', 'رضي الله عنهم', 'رضي الله عنهن', 'عليه السلام', 'عليها السلام', 'صلى الله عليه وسلم', 'حفظه الله', 'حفظها الله', 'نفعنا الله به', 'تعالى'],
  // ignored words between keyword and name (قال، به، إجازة…)
  fillers: ['قال', 'قالا', 'قالوا', 'قالت', 'ثم', 'به', 'بها', 'إجازة', 'سماعا', 'قراءة', 'كتابة'],
};
