/**
 * Account rules for the single user of an instance, and the login lockout
 * (in memory: an instance is one process; a restart clears it).
 */
const { HttpError } = require('../utils/httpError');

const MIN_PASSWORD = 8;
const MAX_FAILS = 5;
const LOCK_MS = 10 * 60 * 1000;

function validUsername(v) {
  const u = String(v ?? '').trim();
  if (u.length < 3 || u.length > 40) throw new HttpError(400, 'اسم المستخدم بين 3 و40 حرفاً');
  if (/\s/.test(u)) throw new HttpError(400, 'اسم المستخدم بلا مسافات');
  return u;
}

function validPassword(v) {
  const p = String(v ?? '');
  if (p.length < MIN_PASSWORD) throw new HttpError(400, `كلمة المرور ${MIN_PASSWORD} أحرف على الأقل`);
  if (p.length > 200) throw new HttpError(400, 'كلمة المرور طويلة جداً');
  return p;
}

/** Failed logins per username: after MAX_FAILS the name is locked for LOCK_MS. */
function createLimiter({ maxFails = MAX_FAILS, lockMs = LOCK_MS, now = () => Date.now() } = {}) {
  const fails = new Map();
  const key = u => String(u ?? '').trim().toLowerCase();
  return {
    /** Throws 429 while the name is locked. */
    check(u) {
      const f = fails.get(key(u));
      if (f?.until > now()) {
        const min = Math.ceil((f.until - now()) / 60000);
        throw new HttpError(429, `محاولات كثيرة خاطئة — أعد المحاولة بعد ${min} ${min === 1 ? 'دقيقة' : min === 2 ? 'دقيقتين' : 'دقائق'}`);
      }
    },
    fail(u) {
      const k = key(u);
      const f = fails.get(k);
      const count = (f && !(f.until && f.until <= now()) ? f.count : 0) + 1;
      fails.set(k, { count, until: count >= maxFails ? now() + lockMs : 0 });
    },
    success(u) { fails.delete(key(u)); },
  };
}

module.exports = { validUsername, validPassword, createLimiter, MIN_PASSWORD };
