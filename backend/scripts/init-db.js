/** Run schema once if users table missing (cloud first deploy) */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log('No DATABASE_URL — skip init');
    process.exit(0);
  }
  const client = await pool.connect();
  try {
    const r = await client.query(
      "SELECT 1 FROM information_schema.tables WHERE table_name = 'users'"
    );
    if (r.rows.length) {
      console.log('Database already initialized');
      return;
    }
    const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await client.query(sql);
    console.log('Schema + seed loaded');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('init-db failed:', e.message);
  process.exit(1);
});
