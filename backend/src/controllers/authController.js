const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const User   = require('../models/UserModel');
const A      = require('../services/account');
const { HttpError } = require('../utils/httpError');

const limiter = A.createLimiter();
exports.limiter = limiter; // tests

// «remember me» keeps the session for 30 days; otherwise it ends with the browser (and JWT_EXPIRES)
const sign = (user, remember) => jwt.sign(
  { id: user.id, username: user.username, tv: Number(user.token_version) || 0 },
  process.env.JWT_SECRET,
  { expiresIn: remember ? '30d' : process.env.JWT_EXPIRES || '7d' }
);

const checkPassword = async (user, password) => {
  if (!user || !(await bcrypt.compare(String(password ?? ''), user.password_hash)))
    throw new HttpError(403, 'كلمة المرور الحالية غير صحيحة');
};

// first run: no account yet → the login page offers to create it (once)
exports.status = async (req, res) => res.json({ setup: (await User.count()) === 0 });

exports.setup = async (req, res) => {
  const username = A.validUsername(req.body?.username);
  const password = A.validPassword(req.body?.password);
  const user = await User.createFirst(username, await bcrypt.hash(password, 10));
  if (!user) throw new HttpError(403, 'الحساب موجود مسبقاً — سجّل الدخول');
  await User.recordLogin(user.id);
  res.json({ token: sign(user, true), username });
};

exports.login = async (req, res) => {
  const { username, password, remember } = req.body || {};
  if (!username || !password) throw new HttpError(400, 'أدخل اسم المستخدم وكلمة المرور');
  limiter.check(username);
  const user = await User.findByUsername(String(username).trim());
  if (!user || !(await bcrypt.compare(String(password), user.password_hash))) {
    limiter.fail(username);
    throw new HttpError(401, 'اسم المستخدم أو كلمة المرور غير صحيحة');
  }
  limiter.success(username);
  await User.recordLogin(user.id);
  res.json({ token: sign(user, !!remember), username: user.username });
};

exports.me = async (req, res) => {
  const u = await User.findById(req.user.id);
  res.json({ username: u.username, created_at: u.created_at, last_login_at: u.last_login_at, previous_login_at: u.previous_login_at });
};

exports.changeUsername = async (req, res) => {
  const username = A.validUsername(req.body?.username);
  const user = await User.findById(req.user.id);
  await checkPassword(user, req.body?.password);
  try { await User.setUsername(user.id, username); }
  catch (e) { if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, 'اسم المستخدم مستعمل'); throw e; }
  res.json({ username, token: sign({ ...user, username }, req.body?.remember) });
};

// a new password signs out every other device; this one gets a fresh token
exports.changePassword = async (req, res) => {
  const user = await User.findById(req.user.id);
  await checkPassword(user, req.body?.current);
  const next = A.validPassword(req.body?.next);
  if (next === String(req.body?.current)) throw new HttpError(400, 'اختر كلمة مرور مختلفة عن الحالية');
  const tv = Number(user.token_version) + 1;
  await User.setPassword(user.id, await bcrypt.hash(next, 10));
  res.json({ token: sign({ ...user, token_version: tv }, req.body?.remember) });
};

exports.logoutOthers = async (req, res) => {
  const user = await User.findById(req.user.id);
  const tv = Number(user.token_version) + 1;
  await User.bumpTokenVersion(user.id);
  res.json({ token: sign({ ...user, token_version: tv }, req.body?.remember) });
};
