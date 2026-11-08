require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json({ limit: '9mb' })); // frozen ijaza documents can be a few MB

app.use('/api/auth',      require('./routes/auth'));
app.use('/api/persons',   require('./routes/persons'));
app.use('/api/tx-types',  require('./routes/txTypes'));
app.use('/api/mutoon',    require('./routes/mutoon'));
app.use('/api/matn-connections', require('./routes/matnConnections'));
app.use('/api/quran',     require('./routes/quran'));
app.use('/api/quran-connections', require('./routes/quranConnections'));
app.use('/api/graph',     require('./routes/graph'));
app.use('/api/isnad-text', require('./routes/isnadText'));
app.use('/api/ijazat',    require('./routes/ijazat'));

app.get('/api/health', (_, res) => res.json({ ok: true }));

app.use('/api', (_, res) => res.status(404).json({ error: 'Not found' }));
app.use(require('./middleware/errorHandler'));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Isnad API running on :${PORT}`));
