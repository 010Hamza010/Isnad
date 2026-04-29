const r    = require('express').Router();
const auth = require('../middleware/auth');
const c    = require('../controllers/personsController');
r.get('/',      auth, c.list);
r.post('/',     auth, c.create);
r.put('/:id',   auth, c.update);
r.delete('/:id',auth, c.remove);
module.exports = r;
