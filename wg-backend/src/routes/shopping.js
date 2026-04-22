const { Router } = require('express');
const db = require('../db');
const { requireAuth, requireWgMember } = require('../middleware/auth');

const router = Router({ mergeParams: true });

// GET /api/wg/:wgId/shopping — Alle Einkaufsitems
router.get('/', requireAuth, requireWgMember, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT s.*, u.name AS added_by_name, u2.name AS checked_by_name
       FROM shopping_items s
       JOIN users u ON u.id = s.added_by
       LEFT JOIN users u2 ON u2.id = s.checked_by
       WHERE s.wg_id = $1
       ORDER BY s.checked ASC, s.created_at DESC`,
      [req.params.wgId]
    );
    res.json({ items: result.rows });
  } catch (err) {
    console.error('Fehler bei GET /shopping:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// POST /api/wg/:wgId/shopping — Item hinzufügen
router.post('/', requireAuth, requireWgMember, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name erforderlich' });

    const result = await db.query(
      `INSERT INTO shopping_items (wg_id, name, added_by) VALUES ($1, $2, $3) RETURNING *`,
      [req.params.wgId, name.trim(), req.user.userId]
    );

    const item = result.rows[0];
    const userResult = await db.query('SELECT name FROM users WHERE id = $1', [req.user.userId]);
    item.added_by_name = userResult.rows[0]?.name;

    try {
      const { getIO } = require('../sockets');
      getIO().to(`wg:${req.params.wgId}`).emit('shopping:added', { item });
    } catch { /* Socket optional */ }

    res.status(201).json({ item });
  } catch (err) {
    console.error('Fehler bei POST /shopping:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// PATCH /api/wg/:wgId/shopping/:itemId — Item abhaken/enthaken
router.patch('/:itemId', requireAuth, requireWgMember, async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE shopping_items
       SET checked = NOT checked,
           checked_by = CASE WHEN checked = false THEN $1 ELSE NULL END
       WHERE id = $2 AND wg_id = $3
       RETURNING *`,
      [req.user.userId, req.params.itemId, req.params.wgId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Item nicht gefunden' });

    const item = result.rows[0];

    try {
      const { getIO } = require('../sockets');
      getIO().to(`wg:${req.params.wgId}`).emit('shopping:toggled', { item });
    } catch { /* Socket optional */ }

    res.json({ item });
  } catch (err) {
    console.error('Fehler bei PATCH /shopping:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// DELETE /api/wg/:wgId/shopping/:itemId — Item löschen
router.delete('/:itemId', requireAuth, requireWgMember, async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM shopping_items WHERE id = $1 AND wg_id = $2 RETURNING id',
      [req.params.itemId, req.params.wgId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Item nicht gefunden' });

    try {
      const { getIO } = require('../sockets');
      getIO().to(`wg:${req.params.wgId}`).emit('shopping:deleted', { itemId: req.params.itemId });
    } catch { /* Socket optional */ }

    res.json({ message: 'Item gelöscht' });
  } catch (err) {
    console.error('Fehler bei DELETE /shopping:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

module.exports = router;
