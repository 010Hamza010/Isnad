const r    = require('express').Router();
const auth = require('../middleware/auth');
const w    = require('../utils/asyncHandler');
const c    = require('../controllers/txTypesController');
r.get('/', auth, w(c.list));
r.get('/kinds', auth, w(c.kinds));
r.put('/:id/kind', auth, w(c.setKind));
module.exports = r;
