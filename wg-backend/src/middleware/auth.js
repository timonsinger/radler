const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Nicht eingeloggt' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'wg-secret-key');
    req.user = { userId: decoded.userId, email: decoded.email };
    next();
  } catch {
    return res.status(401).json({ error: 'Ungültiger Token' });
  }
}

function requireWgMember(req, res, next) {
  const db = require('../db');
  const wgId = req.params.wgId;
  if (!wgId) return res.status(400).json({ error: 'WG-ID fehlt' });

  db.query('SELECT id FROM wg_members WHERE wg_id = $1 AND user_id = $2', [wgId, req.user.userId])
    .then((result) => {
      if (result.rows.length === 0) return res.status(403).json({ error: 'Kein Mitglied dieser WG' });
      next();
    })
    .catch((err) => {
      console.error('Fehler bei WG-Member-Check:', err);
      res.status(500).json({ error: 'Interner Serverfehler' });
    });
}

module.exports = { requireAuth, requireWgMember };
