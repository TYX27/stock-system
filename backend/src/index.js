const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { requireAuth } = require('./middleware/auth');
const auth = require('./routes/auth');
const branches = require('./routes/branches');
const items = require('./routes/items');
const transactions = require('./routes/transactions');
const serials = require('./routes/serials');
const reports = require('./routes/reports');
const importRoutes = require('./routes/import');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/auth', auth);
app.use('/api/branches', requireAuth, branches);
app.use('/api/items', requireAuth, items);
app.use('/api/transactions', requireAuth, transactions);
app.use('/api/serials', requireAuth, serials);
app.use('/api/reports', requireAuth, reports);
app.use('/api/import', requireAuth, importRoutes);

// Serve React build in production (same URL for API + website)
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(publicDir, 'index.html'), (err) => {
    if (err) next();
  });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Stock system on port ${PORT}`);
});
