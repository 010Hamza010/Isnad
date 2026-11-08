const r    = require('express').Router();
const auth = require('../middleware/auth');
const w    = require('../utils/asyncHandler');
const c    = require('../controllers/quranConnectionsController');
r.get('/',      auth, w(c.list));
r.post('/',     auth, w(c.create));
r.put('/:id',   auth, w(c.update));
r.delete('/:id',auth, w(c.remove));
module.exports = r;
