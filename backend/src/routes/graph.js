const r    = require('express').Router();
const auth = require('../middleware/auth');
const w    = require('../utils/asyncHandler');
const c    = require('../controllers/graphController');
r.get('/matn/:id/paths', auth, w(c.matnPaths));
r.get('/quran/paths',    auth, w(c.quranPaths));
r.put('/disabled-routes/:scope', auth, w(c.setDisabledRoutes));
r.get('/full',           auth, w(c.fullGraph));
module.exports = r;
