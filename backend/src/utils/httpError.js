class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Throw a 400 when any of the listed body fields is empty.
const requireFields = (body, fields) => {
  const missing = fields.filter(f => body?.[f] === undefined || body?.[f] === null || String(body[f]).trim() === '');
  if (missing.length) throw new HttpError(400, `Missing fields: ${missing.join(', ')}`);
};

module.exports = { HttpError, requireFields };
