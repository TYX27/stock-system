/** Run schema once if users table missing (cloud first deploy) */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('ERROR: DATABASE_URL is not set on this service.');
    console.error('In Railway: stock-system → Variables → add DATABASE_URL from Postgres.');
    process.exit(1);
  }

  const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
  console.log('Connecting to database…', isLocal ? '(local)' : '(cloud SSL)');

  const pool = new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });

  let client;
  try {
    client = await pool.connect();
    const r = await client.query(
      "SELECT 1 FROM information_schema.tables WHERE table_name = 'users'"
    );
    if (r.rows.length) {
      console.log('Database already initialized');
      return;
    }

    const candidates = [
      path.join(__dirname, '..', '..', 'database', 'schema.sql'),
      path.join(process.cwd(), 'database', 'schema.sql'),
      path.join(__dirname, '..', 'database', 'schema.sql'),
    ];
    let schemaPath = null;
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        schemaPath = p;
        break;
      }
    }
    if (!schemaPath) {
      console.error('schema.sql not found. Tried:', candidates.join(' | '));
      process.exit(1);
    }

    console.log('Loading schema from', schemaPath);
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await client.query(sql);
    console.log('Schema + seed loaded OK');
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('init-db failed:', e && (e.stack || e.message || String(e)));
  if (e && e.code) console.error('code:', e.code);
  process.exit(1);
});
