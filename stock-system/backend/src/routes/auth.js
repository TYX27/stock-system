const express = require('express');
const db = require('../db');
const { signToken, requireAuth, requireAdmin } = require('../middleware/auth');
const router = express.Router();

/** Login */
router.post('/login', async (req, res, next) => {
  try {
    const username = (req.body.username || '').trim();
    const password = req.body.password || '';
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const { rows } = await db.query(
      `SELECT id, username, display_name, role, active,
              (password_hash = crypt($2, password_hash)) AS ok
       FROM users WHERE LOWER(username) = LOWER($1)`,
      [username, password]
    );
    const user = rows[0];
    if (!user || !user.ok) {
      return res.status(401).json({ error: 'Wrong username or password' });
    }
    if (!user.active) {
      return res.status(401).json({ error: 'Account disabled' });
    }

    const token = signToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role,
      },
    });
  } catch (e) {
    next(e);
  }
});

/** Current user */
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await db.query(
      'SELECT id, username, display_name AS "displayName", role FROM users WHERE id = $1 AND active = TRUE',
      [req.user.id]
    );
    if (!rows[0]) return res.status(401).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

/** List users (any logged-in user can view; only admin can edit/delete) */
router.get('/users', requireAuth, async (_req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT id, username, display_name AS "displayName", role, active, created_at AS "createdAt"
       FROM users ORDER BY id`
    );
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

/** Create user (admin only) — or first user if no users exist */
router.post('/users', async (req, res, next) => {
  try {
    const username = (req.body.username || '').trim();
    const password = req.body.password || '';
    const displayName = (req.body.displayName || req.body.display_name || '').trim();
    let role = req.body.role === 'admin' ? 'admin' : 'user';

    if (!username || password.length < 4) {
      return res.status(400).json({ error: 'Username and password (min 4 chars) required' });
    }

    const count = await db.query('SELECT COUNT(*)::int AS n FROM users');
    const isFirst = count.rows[0].n === 0;

    if (!isFirst) {
      // must be admin
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;
      if (!token) return res.status(401).json({ error: 'Admin login required to create users' });
      const jwt = require('jsonwebtoken');
      const { JWT_SECRET } = require('../middleware/auth');
      let payload;
      try {
        payload = jwt.verify(token, JWT_SECRET);
      } catch {
        return res.status(401).json({ error: 'Session expired' });
      }
      if (payload.role !== 'admin') {
        return res.status(403).json({ error: 'Only admin can create users' });
      }
    } else {
      role = 'admin';
    }

    const { rows } = await db.query(
      `INSERT INTO users (username, password_hash, display_name, role)
       VALUES ($1, crypt($2, gen_salt('bf')), $3, $4)
       RETURNING id, username, display_name AS "displayName", role`,
      [username, password, displayName || username, role]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Username already exists' });
    next(e);
  }
});

/** Update user (admin) — username, displayName, role, active, password */
router.patch('/users/:id', requireAdmin, async (req, res, next) => {
  try {
    const fields = [];
    const vals = [];
    let i = 1;
    if (req.body.username !== undefined) {
      const username = String(req.body.username || '').trim();
      if (!username) return res.status(400).json({ error: 'Username cannot be empty' });
      fields.push(`username = $${i++}`);
      vals.push(username);
    }
    if (req.body.active !== undefined) {
      fields.push(`active = $${i++}`);
      vals.push(!!req.body.active);
    }
    if (req.body.role) {
      fields.push(`role = $${i++}`);
      vals.push(req.body.role === 'admin' ? 'admin' : 'user');
    }
    if (req.body.password && req.body.password.length >= 4) {
      fields.push(`password_hash = crypt($${i++}, gen_salt('bf'))`);
      vals.push(req.body.password);
    }
    if (req.body.displayName !== undefined) {
      fields.push(`display_name = $${i++}`);
      vals.push(req.body.displayName);
    }
    if (!fields.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(req.params.id);
    const { rows } = await db.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${i}
       RETURNING id, username, display_name AS "displayName", role, active`,
      vals
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Username already exists' });
    next(e);
  }
});

/** Delete user (admin) — cannot delete yourself */
router.delete('/users/:id', requireAdmin, async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { rowCount } = await db.query('DELETE FROM users WHERE id = $1', [id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true, deletedSelf: req.user.id === id });
  } catch (e) {
    next(e);
  }
});

module.exports = router;
