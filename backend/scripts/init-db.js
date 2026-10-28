/** Optional local/cloud schema init — does NOT use dotenv */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('ERROR: DATABASE_URL is not set');
    process.exit(1);
  }
  const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
  const pool = new Pool({
    connectionString,
    ssl: isLocal ? false : { rejectUnauthorized: false },
  });
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
    await client.query(fs.readFileSync(schemaPath, 'utf8'));
    console.log('Schema + seed loaded OK');
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
