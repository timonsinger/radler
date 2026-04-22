const { Router } = require('express');
const crypto = require('crypto');
const db = require('../db');
const { requireAuth, requireWgMember } = require('../middleware/auth');

const router = Router();

// POST /api/wg — WG erstellen
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'WG-Name erforderlich' });

    // Check ob User schon in einer WG ist
    const existing = await db.query('SELECT id FROM wg_members WHERE user_id = $1', [req.user.userId]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Du bist bereits in einer WG' });
    }

    // Invite-Code generieren (8 Hex-Zeichen)
    let invite_code;
    for (let i = 0; i < 10; i++) {
      invite_code = crypto.randomBytes(4).toString('hex').toUpperCase();
      const check = await db.query('SELECT id FROM wgs WHERE invite_code = $1', [invite_code]);
      if (check.rows.length === 0) break;
    }

    const wgResult = await db.query(
      'INSERT INTO wgs (name, invite_code, created_by) VALUES ($1, $2, $3) RETURNING *',
      [name, invite_code, req.user.userId]
    );
    const wg = wgResult.rows[0];

    // Creator automatisch als Mitglied hinzufügen
    await db.query('INSERT INTO wg_members (wg_id, user_id) VALUES ($1, $2)', [wg.id, req.user.userId]);

    res.status(201).json({ wg });
  } catch (err) {
    console.error('Fehler bei POST /wg:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// POST /api/wg/join — WG beitreten
router.post('/join', requireAuth, async (req, res) => {
  try {
    const { invite_code } = req.body;
    if (!invite_code) return res.status(400).json({ error: 'Einladungscode erforderlich' });

    // Check ob User schon in einer WG ist
    const existing = await db.query('SELECT id FROM wg_members WHERE user_id = $1', [req.user.userId]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Du bist bereits in einer WG' });
    }

    const wgResult = await db.query('SELECT * FROM wgs WHERE invite_code = $1', [invite_code.toUpperCase()]);
    if (wgResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ungültiger Einladungscode' });
    }

    const wg = wgResult.rows[0];
    await db.query('INSERT INTO wg_members (wg_id, user_id) VALUES ($1, $2)', [wg.id, req.user.userId]);

    // Socket: andere Mitglieder benachrichtigen
    try {
      const { getIO } = require('../sockets');
      const io = getIO();
      const userResult = await db.query('SELECT name, profile_image_url FROM users WHERE id = $1', [req.user.userId]);
      io.to(`wg:${wg.id}`).emit('wg:member_joined', {
        user: { id: req.user.userId, ...userResult.rows[0] },
      });
    } catch { /* Socket optional */ }

    res.json({ wg });
  } catch (err) {
    console.error('Fehler bei POST /wg/join:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// GET /api/wg/:wgId — WG-Details + Mitglieder
router.get('/:wgId', requireAuth, requireWgMember, async (req, res) => {
  try {
    const { wgId } = req.params;
    const wgResult = await db.query('SELECT * FROM wgs WHERE id = $1', [wgId]);
    if (wgResult.rows.length === 0) return res.status(404).json({ error: 'WG nicht gefunden' });

    const membersResult = await db.query(
      `SELECT u.id, u.name, u.email, u.profile_image_url, m.joined_at
       FROM wg_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.wg_id = $1
       ORDER BY m.joined_at`,
      [wgId]
    );

    res.json({ wg: wgResult.rows[0], members: membersResult.rows });
  } catch (err) {
    console.error('Fehler bei GET /wg/:wgId:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// DELETE /api/wg/:wgId/leave — WG verlassen
router.delete('/:wgId/leave', requireAuth, requireWgMember, async (req, res) => {
  try {
    await db.query('DELETE FROM wg_members WHERE wg_id = $1 AND user_id = $2', [req.params.wgId, req.user.userId]);
    res.json({ message: 'WG verlassen' });
  } catch (err) {
    console.error('Fehler bei DELETE /wg/leave:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

module.exports = router;
