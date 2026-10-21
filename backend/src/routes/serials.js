const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const router = express.Router();

const LIST_SQL = `
  SELECT
    s.id, s.serial, s.status, s.notes,
    s.taken_by AS "takenBy", s.recorded_by AS "recordedBy",
    s.year, s.month, s.day, s.hour, s.min,
    i.id AS "itemId", i.name AS item, i.category,
    b.id AS "branchId", b.name AS branch
  FROM serial_registry s
  JOIN items i ON i.id = s.item_id
  LEFT JOIN branches b ON b.id = s.branch_id
  ORDER BY s.id DESC
`;

router.get('/', async (req, res, next) => {
  try {
    let sql = LIST_SQL;
    const params = [];
    if (req.query.status && req.query.status !== 'all') {
      sql = LIST_SQL.replace('ORDER BY', 'WHERE s.status = $1 ORDER BY');
      params.push(req.query.status);
    }
    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

/** Register serial for stock already on hand (no transaction required) */
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const b = req.body;
    const serial = (b.serial || '').trim();
    if (!serial) return res.status(400).json({ error: 'Serial required' });

    let itemId = b.itemId || b.item_id;
    if (!itemId && b.item) {
      const r = await db.query('SELECT id FROM items WHERE name = $1', [b.item]);
      itemId = r.rows[0]?.id;
    }
    if (!itemId) return res.status(400).json({ error: 'Item required' });

    let branchId = b.branchId || b.branch_id || null;
    if (!branchId && b.branch) {
      const r = await db.query('SELECT id FROM branches WHERE name = $1', [b.branch]);
      branchId = r.rows[0]?.id || null;
    }

    const now = new Date();
    const status = b.status === 'Taken Out' ? 'Taken Out' : 'In Stock';

    const { rows } = await db.query(
      `INSERT INTO serial_registry
        (item_id, serial, status, branch_id, taken_by, recorded_by, notes, year, month, day, hour, min)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id`,
      [
        itemId,
        serial,
        status,
        branchId,
        status === 'Taken Out' ? (b.takenBy || b.taken_by || '') : (b.takenBy || b.taken_by || ''),
        b.recordedBy || b.recorded_by || '',
        b.notes || '',
        b.year || now.getFullYear(),
        b.month || now.getMonth() + 1,
        b.day || now.getDate(),
        b.hour || String(now.getHours()).padStart(2, '0'),
        b.min || String(now.getMinutes()).padStart(2, '0'),
      ]
    );

    const full = await db.query(
      LIST_SQL.replace('ORDER BY s.id DESC', 'WHERE s.id = $1 ORDER BY s.id DESC'),
      [rows[0].id]
    );
    res.status(201).json(full.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Serial already registered for this item' });
    next(e);
  }
});

router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    const b = req.body;
    const fields = [];
    const vals = [];
    let i = 1;

    if (b.serial !== undefined) {
      const serial = String(b.serial || '').trim();
      if (!serial) return res.status(400).json({ error: 'Serial required' });
      fields.push(`serial = $${i++}`);
      vals.push(serial);
    }
    if (b.status) {
      fields.push(`status = $${i++}`);
      vals.push(b.status === 'Taken Out' ? 'Taken Out' : 'In Stock');
    }
    if (b.takenBy !== undefined || b.taken_by !== undefined) {
      fields.push(`taken_by = $${i++}`);
      vals.push(b.takenBy ?? b.taken_by ?? '');
    }
    if (b.recordedBy !== undefined || b.recorded_by !== undefined) {
      fields.push(`recorded_by = $${i++}`);
      vals.push(b.recordedBy ?? b.recorded_by ?? '');
    }
    if (b.notes !== undefined) {
      fields.push(`notes = $${i++}`);
      vals.push(b.notes);
    }
    // Item by id or name
    if (b.itemId || b.item_id || b.item) {
      let itemId = b.itemId || b.item_id;
      if (!itemId && b.item) {
        const r = await db.query('SELECT id FROM items WHERE name = $1', [b.item]);
        itemId = r.rows[0]?.id;
      }
      if (itemId) {
        fields.push(`item_id = $${i++}`);
        vals.push(itemId);
      }
    }
    // Branch by id or name
    if (b.branchId !== undefined || b.branch_id !== undefined || b.branch !== undefined) {
      let branchId = b.branchId ?? b.branch_id ?? null;
      if (branchId == null && b.branch) {
        const r = await db.query('SELECT id FROM branches WHERE name = $1', [b.branch]);
        branchId = r.rows[0]?.id || null;
      }
      fields.push(`branch_id = $${i++}`);
      vals.push(branchId);
    }
    // Explicit date/time (preferred)
    if (b.year !== undefined) {
      fields.push(`year = $${i++}`);
      vals.push(parseInt(b.year, 10) || null);
    }
    if (b.month !== undefined) {
      fields.push(`month = $${i++}`);
      vals.push(parseInt(b.month, 10) || null);
    }
    if (b.day !== undefined) {
      fields.push(`day = $${i++}`);
      vals.push(parseInt(b.day, 10) || null);
    }
    if (b.hour !== undefined) {
      fields.push(`hour = $${i++}`);
      vals.push(String(b.hour).padStart(2, '0'));
    }
    if (b.min !== undefined) {
      fields.push(`min = $${i++}`);
      vals.push(String(b.min).padStart(2, '0'));
    }

    if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(req.params.id);
    await db.query(
      `UPDATE serial_registry SET ${fields.join(', ')} WHERE id = $${i}`,
      vals
    );
    const full = await db.query(
      LIST_SQL.replace('ORDER BY s.id DESC', 'WHERE s.id = $1 ORDER BY s.id DESC'),
      [req.params.id]
    );
    res.json(full.rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Serial already registered for this item' });
    next(e);
  }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    await db.query('DELETE FROM serial_registry WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
