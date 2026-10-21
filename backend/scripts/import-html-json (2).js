/**
 * Import HTML system backup JSON into PostgreSQL.
 *
 * Usage:
 *   node scripts/import-html-json.js path/to/stock_system_backup.json
 *   node scripts/import-html-json.js path/to/backup.json --clear
 *
 * --clear  deletes existing transactions + serials before import
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const API = process.env.API_URL || 'http://localhost:4000';

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/import-html-json.js <backup.json> [--clear]');
    process.exit(1);
  }
  const clear = process.argv.includes('--clear');
  const raw = fs.readFileSync(path.resolve(file), 'utf8');
  const data = JSON.parse(raw);
  if (clear) data.clear = true;

  const url = `${API}/api/import/html-json${clear ? '?clear=1' : ''}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const body = await res.json();
  if (!res.ok) {
    console.error('Import failed:', body);
    process.exit(1);
  }
  console.log('Import OK:', body);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
