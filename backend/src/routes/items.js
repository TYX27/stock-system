const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const router = express.Router();

/** Current stock = starting - take outs + add stock */
const STOCK_SQL = `
  SELECT
    i.id,
    i.name,
    i.category,
    i.starting_stock AS starting,
    COALESCE(SUM(CASE WHEN t.type = 'Take Out' THEN t.qty ELSE 0 END), 0)::int AS taken,
    COALESCE(SUM(CASE WHEN t.type = 'Add Stock' THEN t.qty ELSE 0 END), 0)::int AS added,
    (i.starting_stock
      - COALESCE(SUM(CASE WHEN t.type = 'Take Out' THEN t.qty ELSE 0 END), 0)
      + COALESCE(SUM(CASE WHEN t.type = 'Add Stock' THEN t.qty ELSE 0 END), 0)
    )::int AS current
  FROM items i
  LEFT JOIN transactions t ON t.item_id = i.id
  GROUP BY i.id
  ORDER BY i.category ASC, i.name ASC
`;

function statusFor(row) {
  const isPhone =
    (row.category || '').includes('Mobile') ||
    (row.category || '').includes('Phone');
  if (isPhone) return '';
  if (row.current <= 0) return 'No Stock';
  if (row.current <= 2) return 'LOW STOCK';
  return '';
}

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await db.query(STOCK_SQL);
    res.json(
      rows.map((r) => ({
        ...r,
        status: statusFor(r),
      }))
    );
  } catch (e) {
    next(e);
  }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const name = (req.body.name || '').trim();
    const category = (req.body.category || 'Other').trim();
    const starting = parseInt(req.body.starting_stock ?? req.body.starting ?? 0, 10) || 0;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const { rows } = await db.query(
      `INSERT INTO items (name, category, starting_stock)
       VALUES ($1, $2, $3) RETURNING id, name, category, starting_stock AS starting`,
      [name, category, starting]
    );
    res.status(201).json({ ...rows[0], taken: 0, added: 0, current: starting, status: statusFor({ ...rows[0], current: starting }) });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Item exists' });
    next(e);
  }
});

router.patch('/:id', requireAdmin, async (req, res, next) => {
  try {
    const fields = [];
    const vals = [];
    let i = 1;
    if (req.body.starting_stock !== undefined || req.body.starting !== undefined) {
      fields.push(`starting_stock = $${i++}`);
      vals.push(parseInt(req.body.starting_stock ?? req.body.starting, 10) || 0);
    }
    if (req.body.category !== undefined) {
      fields.push(`category = $${i++}`);
      vals.push(req.body.category);
    }
    if (req.body.name !== undefined) {
      fields.push(`name = $${i++}`);
      vals.push(req.body.name.trim());
    }
    if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(req.params.id);
    const { rows } = await db.query(
      `UPDATE items SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, name, category, starting_stock AS starting`,
      vals
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    await db.query('DELETE FROM items WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
