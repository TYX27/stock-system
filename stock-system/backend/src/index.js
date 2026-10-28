const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
try { require('dotenv').config(); } catch (_) {}

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

// Serve React build (same URL for API + website)
const publicDir = path.join(__dirname, '..', 'public');
const indexHtml = path.join(publicDir, 'index.html');

if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
}

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  if (fs.existsSync(indexHtml)) {
    return res.sendFile(indexHtml);
  }
  res
    .status(200)
    .type('html')
    .send(
      '<h1>Stock API is running</h1><p>Frontend files missing. Check Railway build logs for <code>npm run build</code>.</p><p><a href="/api/health">/api/health</a></p>'
    );
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Stock system on port ${PORT}`);
  console.log('Public dir:', publicDir, 'index exists:', fs.existsSync(indexHtml));
});
