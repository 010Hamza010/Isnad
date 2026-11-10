const r    = require('express').Router();
const auth = require('../middleware/auth');
const w    = require('../utils/asyncHandler');
const c    = require('../controllers/authController');
// one instance = one user: no registration; the account is created once, on first run
r.get('/status',        w(c.status));
r.post('/setup',        w(c.setup));
r.post('/login',        w(c.login));
r.get('/me',            auth, w(c.me));
r.put('/username',      auth, w(c.changeUsername));
r.put('/password',      auth, w(c.changePassword));
r.post('/logout-others', auth, w(c.logoutOthers));
module.exports = r;
