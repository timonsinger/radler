const jwt = require('jsonwebtoken');
const db = require('../db');

// JWT Middleware – prüft den Authorization Header und hängt User-Daten an req.user
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Kein Token vorhanden' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };

    // Ban-Check
    const userResult = await db.query('SELECT is_banned FROM users WHERE id = $1', [decoded.userId]);
    if (userResult.rows.length > 0 && userResult.rows[0].is_banned) {
      return res.status(403).json({ error: 'Dein Account wurde gesperrt.' });
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Ungültiger oder abgelaufener Token' });
  }
}

module.exports = authMiddleware;
