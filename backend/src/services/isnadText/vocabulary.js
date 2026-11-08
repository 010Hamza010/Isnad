/**
 * Built-in parsing vocabulary, always active on top of the user's keywords.
 * Values are transmission kinds (see ../txKinds.js).
 */

// Forms that introduce the next shaykh («… بسماعه من فلان»).
const LINK_FORMS = [
  ['سمعت من لفظ', 'lafz'], ['وهو سمع من لفظ', 'lafz'], ['بسماعه من لفظ', 'lafz'], ['وصية من', 'wasiyya'], ['أوصى لي', 'wasiyya'],
  ['سمعت على', 'sama'], ['سمعنا على', 'sama'], ['سمعت عليه', 'sama'], ['وهو سمع على', 'sama'], ['وهو سمعه من', 'sama'], ['وهو سمعه على', 'sama'],
  ['سمع من', 'sama'], ['سمع على', 'sama'], ['بسماعه من', 'sama'], ['بسماعه على', 'sama'], ['بسماعي من', 'sama'], ['بسماعي على', 'sama'],
  ['قرأ على', 'qiraa'], ['قرأنا على', 'qiraa'], ['بقراءته على', 'qiraa'], ['بقراءتي على', 'qiraa'], ['وهو قرأه على', 'qiraa'],
  ['بإجازته من', 'ijaza'], ['بإجازته عن', 'ijaza'], ['أجازه', 'ijaza'], ['بإجازته العامة من', 'ijaza_general'],
  ['عرض على', 'ard'], ['عرضنا على', 'ard'], ['بعرضه على', 'ard'], ['بعرضي على', 'ard'],
  ['قرئ عليه وأنا أسمع', 'sama_reading'], ['بقراءة غيري على', 'sama_reading'], ['بقراءة غيره على', 'sama_reading'],
];

// Phrases written AFTER a name that state how it was taken («عن فلان سماعاً عليه»).
// tx: transmission type; mode: reading from memory ('heart') or from the text ('looking').
const MANNERS = [
  ['سماعا', { tx: 'sama' }], ['سماعا عليه', { tx: 'sama' }], ['سماعا منه', { tx: 'sama' }], ['سماعا من لفظه', { tx: 'lafz' }],
  ['من لفظه', { tx: 'lafz' }], ['سمعت عليه', { tx: 'sama' }], ['سمعت منه', { tx: 'sama' }], ['بسماعي عليه', { tx: 'sama' }], ['بسماعي منه', { tx: 'sama' }],
  ['قراءة عليه', { tx: 'qiraa' }], ['قرأت عليه', { tx: 'qiraa' }], ['بقراءتي عليه', { tx: 'qiraa' }],
  ['قراءة عليه وأنا أسمع', { tx: 'sama_reading' }], ['قراءة عليه وهو يسمع', { tx: 'sama_reading' }], ['وأنا أسمع', { tx: 'sama_reading' }], ['وهو يسمع', { tx: 'sama_reading' }],
  ['إجازة', { tx: 'ijaza' }], ['إجازة عامة', { tx: 'ijaza_general' }], ['مناولة', { tx: 'munawala' }], ['مكاتبة', { tx: 'kitaba' }], ['كتابة', { tx: 'kitaba' }], ['وجادة', { tx: 'wijada' }],
  ['عرضا', { tx: 'ard' }], ['عرضا عليه', { tx: 'ard' }], ['عرضت عليه', { tx: 'ard' }],
  ['حفظا', { mode: 'heart' }], ['غيبا', { mode: 'heart' }], ['غيبا من حفظي', { mode: 'heart' }], ['غيبا من حفظه', { mode: 'heart' }], ['عن ظهر قلب', { mode: 'heart' }],
  ['من حفظي', { mode: 'heart' }], ['من حفظه', { mode: 'heart' }],
  ['نظرا', { mode: 'looking' }], ['من المصحف', { mode: 'looking' }], ['من الكتاب', { mode: 'looking' }],
];

module.exports = { LINK_FORMS, MANNERS };
