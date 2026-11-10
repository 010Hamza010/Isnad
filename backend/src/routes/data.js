const r    = require('express').Router();
const auth = require('../middleware/auth');
const w    = require('../utils/asyncHandler');
const c    = require('../controllers/dataController');
r.get('/backup',             auth, w(c.download));
r.get('/backup/pre-restore', auth, w(c.preRestore));
r.get('/summary',            auth, w(c.summary));
r.post('/restore',           auth, w(c.restore));
module.exports = r;
