const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const router = express.Router();

const LIST_SQL = `
  SELECT
    t.id, t.year, t.month, t.day, t.hour, t.min,
    t.type, t.qty, t.notes, t.taken_by AS "takenBy", t.recorded_by AS "recordedBy",
    t.serial,
    b.id AS "branchId", b.name AS branch,
    i.id AS "itemId", i.name AS item, i.category
  FROM transactions t
  JOIN branches b ON b.id = t.branch_id
  JOIN items i ON i.id = t.item_id
  ORDER BY t.year DESC, t.month DESC, t.day DESC, t.hour DESC, t.min DESC, t.id DESC
`;

function isSerializedItem(name, category) {
  const n = (name || '').toLowerCase();
  const c = (category || '').toLowerCase();
  if (c.includes('mobile') || c.includes('phone')) return true;
  if (c.includes('printer')) return true;
  if (/phone|galaxy|realme|huawei|motorola|oneplus|monitor|printer|toner|hprt|epson|brother|lenovo/i.test(n))
    return true;
  return false;
}

async function syncSerial(client, body, itemId, itemName, category) {
  const serialRaw = (body.serial || '').trim();
  if (!serialRaw) return;
  const parts = serialRaw.split(/[,;]+/).map((x) => x.trim()).filter(Boolean);
  const now = new Date();

  for (const ser of parts) {
    const existing = await client.query(
      'SELECT id FROM serial_registry WHERE item_id = $1 AND LOWER(serial) = LOWER($2)',
      [itemId, ser]
    );

    const status = body.type === 'Take Out' ? 'Taken Out' : 'In Stock';
    const takenBy = body.type === 'Take Out' ? (body.takenBy || body.taken_by || '') : '';
    const recordedBy = body.recordedBy || body.recorded_by || '';

    if (existing.rows[0]) {
      await client.query(
        `UPDATE serial_registry SET
          status = $1, taken_by = $2, recorded_by = COALESCE(NULLIF($3,''), recorded_by),
          branch_id = COALESCE($4, branch_id),
          year = $5, month = $6, day = $7, hour = $8, min = $9
         WHERE id = $10`,
        [
          status,
          takenBy,
          recordedBy,
          body.branchId || body.branch_id || null,
          body.year || now.getFullYear(),
          body.month || now.getMonth() + 1,
          body.day || now.getDate(),
          body.hour || String(now.getHours()).padStart(2, '0'),
          body.min || String(now.getMinutes()).padStart(2, '0'),
          existing.rows[0].id,
        ]
      );
    } else {
      await client.query(
        `INSERT INTO serial_registry
          (item_id, serial, status, branch_id, taken_by, recorded_by, notes, year, month, day, hour, min)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          itemId,
          ser,
          status,
          body.branchId || body.branch_id || null,
          takenBy,
          recordedBy,
          body.notes || '',
          body.year || now.getFullYear(),
          body.month || now.getMonth() + 1,
          body.day || now.getDate(),
          body.hour || String(now.getHours()).padStart(2, '0'),
          body.min || String(now.getMinutes()).padStart(2, '0'),
        ]
      );
    }
  }
}

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await db.query(LIST_SQL);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/', requireAdmin, async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const b = req.body;
    const qty = parseInt(b.qty, 10);
    if (!qty || qty < 1) return res.status(400).json({ error: 'Valid qty required' });

    let branchId = b.branchId || b.branch_id;
    let itemId = b.itemId || b.item_id;

    if (!branchId && b.branch) {
      const r = await client.query('SELECT id FROM branches WHERE name = $1', [b.branch]);
      branchId = r.rows[0]?.id;
    }
    if (!itemId && b.item) {
      const r = await client.query('SELECT id, name, category FROM items WHERE name = $1', [b.item]);
      itemId = r.rows[0]?.id;
      b._itemName = r.rows[0]?.name;
      b._category = r.rows[0]?.category;
    }

    if (!branchId || !itemId) {
      return res.status(400).json({ error: 'Branch and item required' });
    }

    const itemRow = await client.query('SELECT name, category FROM items WHERE id = $1', [itemId]);
    const itemName = itemRow.rows[0]?.name || b.item;
    const category = itemRow.rows[0]?.category || '';

    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO transactions
        (year, month, day, hour, min, branch_id, item_id, type, qty, notes, taken_by, recorded_by, serial)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id`,
      [
        b.year,
        b.month,
        b.day,
        String(b.hour ?? '00').padStart(2, '0'),
        String(b.min ?? '00').padStart(2, '0'),
        branchId,
        itemId,
        b.type,
        qty,
        b.notes || '',
        b.takenBy || b.taken_by || '',
        b.recordedBy || b.recorded_by || '',
        b.serial || '',
      ]
    );

    await syncSerial(client, { ...b, branchId }, itemId, itemName, category);
    await client.query('COMMIT');

    const full = await db.query(LIST_SQL + ' LIMIT 1'.replace('ORDER BY', `WHERE t.id = ${rows[0].id} ORDER BY`));
    // simpler refetch
    const one = await db.query(
      LIST_SQL.replace('ORDER BY t.year DESC', `WHERE t.id = $1 ORDER BY t.year DESC`),
      [rows[0].id]
    );
    res.status(201).json(one.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

router.put('/:id', requireAdmin, async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    const b = req.body;
    const qty = parseInt(b.qty, 10);
    if (!qty || qty < 1) return res.status(400).json({ error: 'Valid qty required' });

    let branchId = b.branchId || b.branch_id;
    let itemId = b.itemId || b.item_id;
    if (!branchId && b.branch) {
      const r = await client.query('SELECT id FROM branches WHERE name = $1', [b.branch]);
      branchId = r.rows[0]?.id;
    }
    if (!itemId && b.item) {
      const r = await client.query('SELECT id FROM items WHERE name = $1', [b.item]);
      itemId = r.rows[0]?.id;
    }

    await client.query('BEGIN');
    const { rowCount } = await client.query(
      `UPDATE transactions SET
        year=$1, month=$2, day=$3, hour=$4, min=$5,
        branch_id=$6, item_id=$7, type=$8, qty=$9,
        notes=$10, taken_by=$11, recorded_by=$12, serial=$13
       WHERE id=$14`,
      [
        b.year, b.month, b.day,
        String(b.hour ?? '00').padStart(2, '0'),
        String(b.min ?? '00').padStart(2, '0'),
        branchId, itemId, b.type, qty,
        b.notes || '',
        b.takenBy || b.taken_by || '',
        b.recordedBy || b.recorded_by || '',
        b.serial || '',
        req.params.id,
      ]
    );
    if (!rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not found' });
    }

    const itemRow = await client.query('SELECT name, category FROM items WHERE id = $1', [itemId]);
    await syncSerial(client, { ...b, branchId }, itemId, itemRow.rows[0]?.name, itemRow.rows[0]?.category);
    await client.query('COMMIT');

    const one = await db.query(
      LIST_SQL.replace('ORDER BY t.year DESC', 'WHERE t.id = $1 ORDER BY t.year DESC'),
      [req.params.id]
    );
    res.json(one.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally {
    client.release();
  }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    await db.query('DELETE FROM transactions WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
