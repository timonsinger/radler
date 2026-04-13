const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../db');
const authMiddleware = require('../middleware/auth');

// Profilbild Upload
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../../uploads');
const PROFILES_DIR = path.join(UPLOAD_DIR, 'profiles');
if (!fs.existsSync(PROFILES_DIR)) fs.mkdirSync(PROFILES_DIR, { recursive: true });

const profileStorage = multer.diskStorage({
  destination: PROFILES_DIR,
  filename: (req, file, cb) => {
    cb(null, `${req.user.userId}.jpg`);
  },
});
const profileUpload = multer({
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Nur Bilder erlaubt'));
    cb(null, true);
  },
});

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
      'SELECT id, email, password_hash, name, role, is_banned FROM users WHERE email = $1',
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

    // Ban-Check
    if (user.is_banned) {
      return res.status(403).json({ error: 'Dein Account wurde gesperrt.' });
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
      'SELECT id, email, name, phone, role, profile_image_url, created_at FROM users WHERE id = $1',
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
        'SELECT vehicle_type, is_online, rating, description, availability, onboarding_completed, is_approved FROM drivers WHERE user_id = $1',
        [user.id]
      );
      if (driverResult.rows.length > 0) {
        response.driver = driverResult.rows[0];
      }
    }

    // Kunden-Statistiken
    if (user.role === 'customer') {
      const statsResult = await db.query(
        `SELECT COUNT(*) AS total_bookings FROM rides WHERE customer_id = $1`,
        [user.id]
      );
      response.stats = {
        total_bookings: parseInt(statsResult.rows[0].total_bookings, 10),
      };
    }

    res.json(response);
  } catch (err) {
    console.error('Fehler bei /me:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// PATCH /api/auth/profile – Eigenes Profil bearbeiten
router.patch('/profile', authMiddleware, profileUpload.single('profile_image'), async (req, res) => {
  try {
    const { name, phone } = req.body;
    const fields = [];
    const params = [];

    if (name && name.trim().length > 0) {
      params.push(name.trim());
      fields.push(`name = $${params.length}`);
    }
    if (phone !== undefined) {
      params.push(phone || null);
      fields.push(`phone = $${params.length}`);
    }
    if (req.file) {
      const imageUrl = `/uploads/profiles/${req.user.userId}.jpg`;
      params.push(imageUrl);
      fields.push(`profile_image_url = $${params.length}`);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Keine Änderungen angegeben' });
    }

    params.push(req.user.userId);
    const result = await db.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING id, email, name, phone, role, profile_image_url`,
      params
    );

    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Fehler bei PATCH /auth/profile:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// GET /api/auth/profile/:userId – Öffentliches Profil
router.get('/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const userResult = await db.query(
      'SELECT id, name, role, profile_image_url, created_at FROM users WHERE id = $1',
      [userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Benutzer nicht gefunden' });
    }

    const user = userResult.rows[0];
    const profile = {
      id: user.id,
      name: user.name,
      role: user.role,
      profile_image_url: user.profile_image_url,
      member_since: user.created_at,
    };

    // Fahrer-Zusatzinfos
    if (user.role === 'driver') {
      const driverResult = await db.query(
        'SELECT vehicle_type, rating, description, availability FROM drivers WHERE user_id = $1',
        [userId]
      );
      if (driverResult.rows.length > 0) {
        const d = driverResult.rows[0];
        profile.vehicle_type = d.vehicle_type;
        profile.rating = d.rating;
        profile.description = d.description;
        profile.availability = d.availability;
      }

      const ridesResult = await db.query(
        "SELECT COUNT(*) AS total FROM rides WHERE driver_id = $1 AND status = 'delivered'",
        [userId]
      );
      profile.completed_rides = parseInt(ridesResult.rows[0].total, 10);
    }

    res.json({ profile });
  } catch (err) {
    console.error('Fehler bei GET /auth/profile/:userId:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

module.exports = router;
