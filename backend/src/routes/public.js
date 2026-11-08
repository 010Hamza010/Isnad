const r = require('express').Router();
const w = require('../utils/asyncHandler');
const rateLimit = require('../middleware/rateLimit');
const c = require('../controllers/publicController');
r.use(rateLimit({ windowMs: 60_000, max: 60 }));
r.get('/ijazat/code/:code', w(c.byCode));
r.get('/ijazat/:token',     w(c.byToken));
module.exports = r;
