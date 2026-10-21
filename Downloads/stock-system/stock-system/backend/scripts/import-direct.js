/**
 * Import HTML JSON backup straight into PostgreSQL (no API needed).
 *
 * Usage:
 *   node scripts/import-direct.js "C:\Users\user\Desktop\stock_system_backup.json"
 *   node scripts/import-direct.js "C:\Users\user\Desktop\stock_system_backup.json" --clear
 *
 * Requires: Docker Postgres running (docker compose up -d)
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://stock:stockpass@localhost:5433/stock_inventory';
const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/import-direct.js <backup.json> [--clear]');
    process.exit(1);
  }
  const clear = process.argv.includes('--clear');
  const data = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));

  const client = await pool.connect();
  try {
    // test connection
    await client.query('SELECT 1');
    console.log('Connected to PostgreSQL');

    await client.query('BEGIN');

    if (clear) {
      await client.query('DELETE FROM serial_registry');
      await client.query('DELETE FROM transactions');
      console.log('Cleared old transactions + serials');
    }

    const branchMap = {};
    const itemMap = {};

    for (const name of data.branches || []) {
      if (!name || !String(name).trim()) continue;
      const r = await client.query(
        `INSERT INTO branches (name) VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id, name`,
        [String(name).trim()]
      );
      branchMap[r.rows[0].name] = r.rows[0].id;
    }

    for (const it of data.items || []) {
      if (!it?.name) continue;
      const r = await client.query(
        `INSERT INTO items (name, category, starting_stock)
         VALUES ($1, $2, $3)
         ON CONFLICT (name) DO UPDATE SET
           category = EXCLUDED.category,
           starting_stock = EXCLUDED.starting_stock
         RETURNING id, name`,
        [it.name, it.category || 'Other', parseInt(it.starting, 10) || 0]
      );
      itemMap[r.rows[0].name] = r.rows[0].id;
    }

    const allB = await client.query('SELECT id, name FROM branches');
    allB.rows.forEach((b) => { branchMap[b.name] = b.id; });
    const allI = await client.query('SELECT id, name FROM items');
    allI.rows.forEach((i) => { itemMap[i.name] = i.id; });

    let txnCount = 0;
    for (const t of data.transactions || []) {
      const branchId = branchMap[t.branch];
      const itemId = itemMap[t.item];
      if (!branchId || !itemId) {
        console.warn('Skip txn (unknown branch/item):', t.branch, t.item);
        continue;
      }
      await client.query(
        `INSERT INTO transactions
          (year, month, day, hour, min, branch_id, item_id, type, qty, notes, taken_by, recorded_by, serial)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          t.year, t.month, t.day,
          String(t.hour ?? '00').padStart(2, '0'),
          String(t.min ?? '00').padStart(2, '0'),
          branchId, itemId,
          t.type === 'Add Stock' ? 'Add Stock' : 'Take Out',
          parseInt(t.qty, 10) || 1,
          t.notes || '',
          t.takenBy || '',
          t.by || t.recordedBy || '',
          t.serial || '',
        ]
      );
      txnCount++;
    }

    let serialCount = 0;
    for (const s of data.serialRegistry || []) {
      const itemId = itemMap[s.item];
      if (!itemId || !s.serial) continue;
      const branchId = s.branch ? branchMap[s.branch] || null : null;
      await client.query(
        `INSERT INTO serial_registry
          (item_id, serial, status, branch_id, taken_by, recorded_by, notes, year, month, day, hour, min)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (item_id, serial) DO UPDATE SET
           status = EXCLUDED.status,
           taken_by = EXCLUDED.taken_by,
           recorded_by = EXCLUDED.recorded_by,
           notes = EXCLUDED.notes`,
        [
          itemId, String(s.serial).trim(),
          s.status === 'Taken Out' ? 'Taken Out' : 'In Stock',
          branchId,
          s.takenBy || '',
          s.by || s.recordedBy || '',
          s.notes || '',
          s.year || null, s.month || null, s.day || null,
          s.hour || '00', s.min || '00',
        ]
      );
      serialCount++;
    }

    await client.query('COMMIT');
    console.log('Import OK');
    console.log({
      branches: Object.keys(branchMap).length,
      items: Object.keys(itemMap).length,
      transactionsImported: txnCount,
      serialsImported: serialCount,
    });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Import failed:', e.message);
    if (e.code === 'ECONNREFUSED') {
      console.error('\nPostgreSQL is not running. Start Docker first:');
      console.error('  cd C:\\stock-system\\stock-system');
      console.error('  docker compose up -d');
    }
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
