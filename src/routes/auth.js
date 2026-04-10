const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Hilfsfunktion: JWT Token erstellen
function createToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/auth/register – Neuen Benutzer registrieren
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, phone, role } = req.body;

    // Eingaben validieren
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Ungültige E-Mail-Adresse' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen haben' });
    }
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name darf nicht leer sein' });
    }
    if (!role || !['customer', 'driver'].includes(role)) {
      return res.status(400).json({ error: 'Rolle muss customer oder driver sein' });
    }

    // Prüfen ob Email bereits existiert
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email bereits registriert' });
    }

    // Passwort hashen
    const passwordHash = await bcrypt.hash(password, 12);

    // User in DB erstellen
    const userResult = await db.query(
      `INSERT INTO users (email, password_hash, role, name, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, role`,
      [email.toLowerCase(), passwordHash, role, name.trim(), phone || null]
    );
    const user = userResult.rows[0];

    // Falls Fahrer: Eintrag in drivers-Tabelle erstellen
    if (role === 'driver') {
      await db.query(
        'INSERT INTO drivers (user_id) VALUES ($1)',
        [user.id]
      );
      console.log(`Neuer Fahrer registriert: ${name} (${email})`);
    } else {
      console.log(`Neuer Kunde registriert: ${name} (${email})`);
    }

    // JWT Token erstellen
    const token = createToken(user);

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Fehler bei /register:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// POST /api/auth/login – Benutzer anmelden
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email und Passwort erforderlich' });
    }

    // User per Email suchen
    const userResult = await db.query(
      'SELECT id, email, password_hash, name, role FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    const user = userResult.rows[0];

    // Passwort prüfen
    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
    }

    console.log(`Login: ${user.name} (${user.email})`);

    const token = createToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Fehler bei /login:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// GET /api/auth/me – Aktuellen Benutzer laden
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userResult = await db.query(
      'SELECT id, email, name, phone, role, created_at FROM users WHERE id = $1',
      [req.user.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    const user = userResult.rows[0];
    const response = { ...user };

    // Falls Fahrer: Driver-Daten mitschicken
    if (user.role === 'driver') {
      const driverResult = await db.query(
        'SELECT vehicle_type, is_online, rating FROM drivers WHERE user_id = $1',
        [user.id]
      );
      if (driverResult.rows.length > 0) {
        response.driver = driverResult.rows[0];
      }
    }

    res.json(response);
  } catch (err) {
    console.error('Fehler bei /me:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

module.exports = router;
