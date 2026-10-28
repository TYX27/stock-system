/**
 * Import data from the HTML system JSON export (Export JSON button).
 * POST /api/import/html-json
 * Body: { branches, items, transactions, serialRegistry, nextId }
 */
const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const router = express.Router();

router.post('/html-json', requireAdmin, async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const data = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'JSON body required' });
    }

    await client.query('BEGIN');

    // Optional: clear existing transactional data (keep structure)
    const clear = req.query.clear === '1' || req.body.clear === true;
    if (clear) {
      await client.query('DELETE FROM serial_registry');
      await client.query('DELETE FROM transactions');
      // do not delete branches/items by default — upsert instead
    }

    const branchMap = {}; // name -> id
    const itemMap = {}; // name -> id

    // Branches
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

    // Items
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

    // Refresh maps for any pre-existing rows
    const allB = await client.query('SELECT id, name FROM branches');
    allB.rows.forEach((b) => {
      branchMap[b.name] = b.id;
    });
    const allI = await client.query('SELECT id, name FROM items');
    allI.rows.forEach((i) => {
      itemMap[i.name] = i.id;
    });

    let txnCount = 0;
    for (const t of data.transactions || []) {
      const branchId = branchMap[t.branch];
      const itemId = itemMap[t.item];
      if (!branchId || !itemId) continue;
      await client.query(
        `INSERT INTO transactions
          (year, month, day, hour, min, branch_id, item_id, type, qty, notes, taken_by, recorded_by, serial)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          t.year,
          t.month,
          t.day,
          String(t.hour ?? '00').padStart(2, '0'),
          String(t.min ?? '00').padStart(2, '0'),
          branchId,
          itemId,
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
           notes = EXCLUDED.notes,
           branch_id = COALESCE(EXCLUDED.branch_id, serial_registry.branch_id)`,
        [
          itemId,
          String(s.serial).trim(),
          s.status === 'Taken Out' ? 'Taken Out' : 'In Stock',
          branchId,
          s.takenBy || '',
          s.by || s.recordedBy || '',
          s.notes || '',
          s.year || null,
          s.month || null,
          s.day || null,
          s.hour || '00',
          s.min || '00',
        ]
      );
      serialCount++;
    }

    await client.query('COMMIT');
    res.json({
      ok: true,
      branches: Object.keys(branchMap).length,
      items: Object.keys(itemMap).length,
      transactionsImported: txnCount,
      serialsImported: serialCount,
    });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

module.exports = router;
