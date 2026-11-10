const jwt  = require('jsonwebtoken');
const User = require('../models/UserModel');

// a token is valid while its version matches the account's (bumped by a password change or
// «sign out other devices»); the username is read fresh so a rename applies at once
module.exports = async (req, res, next) => {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  let payload;
  try { payload = jwt.verify(h.slice(7), process.env.JWT_SECRET); }
  catch { return res.status(401).json({ error: 'Invalid token' }); }
  try {
    const user = await User.findById(payload.id);
    if (!user || Number(user.token_version || 0) !== Number(payload.tv || 0))
      return res.status(401).json({ error: 'Session ended' });
    req.user = { id: user.id, username: user.username };
    next();
  } catch (err) { next(err); }
};
