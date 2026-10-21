const express = require('express');
const db = require('../db');
const router = express.Router();

/** Branch analysis: units taken per item × branch */
router.get('/branch-analysis', async (_req, res, next) => {
  try {
    const branches = (await db.query('SELECT id, name FROM branches ORDER BY id')).rows;
    const items = (await db.query('SELECT id, name FROM items ORDER BY id')).rows;
    const { rows: taken } = await db.query(`
      SELECT item_id, branch_id, SUM(qty)::int AS qty
      FROM transactions WHERE type = 'Take Out'
      GROUP BY item_id, branch_id
    `);
    const { rows: added } = await db.query(`
      SELECT item_id, SUM(qty)::int AS qty
      FROM transactions WHERE type = 'Add Stock'
      GROUP BY item_id
    `);

    const takeMap = {};
    taken.forEach((r) => {
      takeMap[`${r.item_id}:${r.branch_id}`] = r.qty;
    });
    const addMap = {};
    added.forEach((r) => {
      addMap[r.item_id] = r.qty;
    });

    const matrix = items.map((item) => {
      const byBranch = {};
      let totalTaken = 0;
      branches.forEach((b) => {
        const q = takeMap[`${item.id}:${b.id}`] || 0;
        byBranch[b.name] = q;
        totalTaken += q;
      });
      return {
        item: item.name,
        byBranch,
        totalTaken,
        totalAdded: addMap[item.id] || 0,
      };
    });

    res.json({ branches: branches.map((b) => b.name), matrix });
  } catch (e) {
    next(e);
  }
});

/** Monthly usage filtered by year + month */
router.get('/monthly', async (req, res, next) => {
  try {
    const year = parseInt(req.query.year, 10) || new Date().getFullYear();
    const month = parseInt(req.query.month, 10) || new Date().getMonth() + 1;

    const branches = (await db.query('SELECT id, name FROM branches ORDER BY id')).rows;
    const items = (await db.query('SELECT id, name FROM items ORDER BY id')).rows;
    const { rows: taken } = await db.query(
      `SELECT item_id, branch_id, SUM(qty)::int AS qty
       FROM transactions
       WHERE type = 'Take Out' AND year = $1 AND month = $2
       GROUP BY item_id, branch_id`,
      [year, month]
    );
    const { rows: added } = await db.query(
      `SELECT item_id, SUM(qty)::int AS qty
       FROM transactions
       WHERE type = 'Add Stock' AND year = $1 AND month = $2
       GROUP BY item_id`,
      [year, month]
    );

    const takeMap = {};
    taken.forEach((r) => {
      takeMap[`${r.item_id}:${r.branch_id}`] = r.qty;
    });
    const addMap = {};
    added.forEach((r) => {
      addMap[r.item_id] = r.qty;
    });

    const matrix = items.map((item) => {
      const byBranch = {};
      let totalTaken = 0;
      branches.forEach((b) => {
        const q = takeMap[`${item.id}:${b.id}`] || 0;
        byBranch[b.name] = q;
        totalTaken += q;
      });
      return {
        item: item.name,
        byBranch,
        totalTaken,
        totalAdded: addMap[item.id] || 0,
      };
    });

    res.json({ year, month, branches: branches.map((b) => b.name), matrix });
  } catch (e) {
    next(e);
  }
});

/** Branch ranking */
router.get('/ranking', async (_req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT
        b.name AS branch,
        COALESCE(SUM(CASE WHEN t.type = 'Take Out' THEN t.qty ELSE 0 END), 0)::int AS taken,
        COALESCE(SUM(CASE WHEN t.type = 'Add Stock' THEN t.qty ELSE 0 END), 0)::int AS added
      FROM branches b
      LEFT JOIN transactions t ON t.branch_id = b.id
      GROUP BY b.id, b.name
      ORDER BY taken DESC, b.name
    `);
    res.json(rows.map((r, i) => ({ rank: i + 1, ...r })));
  } catch (e) {
    next(e);
  }
});

/** By category summary */
router.get('/by-category', async (_req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT
        i.category,
        COUNT(*)::int AS items,
        SUM(i.starting_stock)::int AS starting,
        SUM(
          i.starting_stock
          - COALESCE((SELECT SUM(t.qty) FROM transactions t WHERE t.item_id = i.id AND t.type = 'Take Out'), 0)
          + COALESCE((SELECT SUM(t.qty) FROM transactions t WHERE t.item_id = i.id AND t.type = 'Add Stock'), 0)
        )::int AS current
      FROM items i
      GROUP BY i.category
      ORDER BY i.category
    `);

    // low/out count per category (non-phones)
    const detail = await db.query(`
      SELECT i.category, i.name,
        (i.starting_stock
          - COALESCE((SELECT SUM(qty) FROM transactions WHERE item_id = i.id AND type = 'Take Out'), 0)
          + COALESCE((SELECT SUM(qty) FROM transactions WHERE item_id = i.id AND type = 'Add Stock'), 0)
        )::int AS current
      FROM items i
    `);

    const lowMap = {};
    detail.rows.forEach((r) => {
      const isPhone =
        (r.category || '').includes('Mobile') || (r.category || '').includes('Phone');
      if (!isPhone && r.current <= 2) {
        lowMap[r.category] = (lowMap[r.category] || 0) + 1;
      }
    });

    res.json(
      rows.map((r) => ({
        ...r,
        lowOut: lowMap[r.category] || 0,
      }))
    );
  } catch (e) {
    next(e);
  }
});

module.exports = router;
