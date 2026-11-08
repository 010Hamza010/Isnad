const r    = require('express').Router();
const auth = require('../middleware/auth');
const w    = require('../utils/asyncHandler');
const c    = require('../controllers/profileController');
r.get('/', auth, w(c.get));
r.put('/', auth, w(c.save));
module.exports = r;
