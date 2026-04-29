const r    = require('express').Router();
const auth = require('../middleware/auth');
const c    = require('../controllers/txTypesController');
r.get('/', auth, c.list);
module.exports = r;
