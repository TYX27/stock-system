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
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;

async function ensureSchema() {
  if (!process.env.DATABASE_URL) {
    console.error('WARNING: DATABASE_URL not set');
    return;
  }
  try {
    const r = await db.query(
      "SELECT 1 FROM information_schema.tables WHERE table_name = 'users'"
    );
    if (r.rows.length) {
      console.log('Database already initialized');
      return;
    }
    const candidates = [
      path.join(__dirname, '..', '..', 'database', 'schema.sql'),
      path.join(process.cwd(), 'database', 'schema.sql'),
    ];
    for (const schemaPath of candidates) {
      if (fs.existsSync(schemaPath)) {
        console.log('Loading schema from', schemaPath);
        const sql = fs.readFileSync(schemaPath, 'utf8');
        await db.query(sql);
        console.log('Schema + seed loaded OK');
        return;
      }
    }
    console.error('schema.sql not found');
  } catch (e) {
    console.error('ensureSchema:', e.message || e);
  }
}

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
    .send('<h1>Stock API running</h1><p><a href="/api/health">/api/health</a></p>');
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

ensureSchema().finally(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Stock system on port ${PORT}`);
  });
});
