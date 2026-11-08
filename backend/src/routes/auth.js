const r = require('express').Router();
const w = require('../utils/asyncHandler');
const c = require('../controllers/authController');
r.post('/register', w(c.register));
r.post('/login',    w(c.login));
module.exports = r;
