const jwt = require('jsonwebtoken');

// JWT Middleware – prüft den Authorization Header und hängt User-Daten an req.user
function authMiddleware(req, res, next) {
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
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Ungültiger oder abgelaufener Token' });
  }
}

module.exports = authMiddleware;
