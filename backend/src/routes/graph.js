const r    = require('express').Router();
const auth = require('../middleware/auth');
const c    = require('../controllers/graphController');
r.get('/matn/:id/paths', auth, c.matnPaths);
r.get('/quran/paths',    auth, c.quranPaths);
r.get('/full',           auth, c.fullGraph);
module.exports = r;
