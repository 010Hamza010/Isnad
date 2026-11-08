class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Throw a 400 when any of the listed body fields is empty.
const requireFields = (body, fields) => {
  const missing = fields.filter(f => body?.[f] === undefined || body?.[f] === null || String(body[f]).trim() === '');
  if (missing.length) throw new HttpError(400, `Missing fields: ${missing.join(', ')}`);
};

// Validate a from→to link. Only from_person_id may be 0 ("me"); to_person_id has a FK to persons.
const requireValidLink = body => {
  requireFields(body, ['to_person_id']);
  const from = Number(body.from_person_id ?? 0), to = Number(body.to_person_id);
  if (to === 0) throw new HttpError(400, 'لا يمكن ربط اتصال إليك — سجّل تلاميذك في الإجازات');
  if (from === to) throw new HttpError(400, 'لا يمكن أن يتصل الشخص بنفسه');
  if (body.reading_mode != null && body.reading_mode !== '' && !['heart', 'looking'].includes(body.reading_mode))
    throw new HttpError(400, 'طريقة القراءة غير صالحة');
};

module.exports = { HttpError, requireFields, requireValidLink };
