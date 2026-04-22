const { Router } = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'wg-secret-key';

// Multer für Profilbilder
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../../wg-uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(path.join(UPLOAD_DIR, 'profiles'))) fs.mkdirSync(path.join(UPLOAD_DIR, 'profiles'), { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(UPLOAD_DIR, 'profiles')),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).substring(7)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Nur Bilder erlaubt'));
  },
});

function generateToken(user) {
  return jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
}

// POST /api/auth/register
router.post('/register', upload.single('profile_image'), async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Name, E-Mail und Passwort sind erforderlich' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen lang sein' });
    }

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'E-Mail bereits registriert' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const profile_image_url = req.file ? `/uploads/profiles/${req.file.filename}` : null;

    const result = await db.query(
      'INSERT INTO users (email, password_hash, name, profile_image_url) VALUES ($1, $2, $3, $4) RETURNING id, email, name, profile_image_url, created_at',
      [email.toLowerCase(), password_hash, name, profile_image_url]
    );

    const user = result.rows[0];
    const token = generateToken(user);

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Fehler bei Register:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'E-Mail und Passwort erforderlich' });
    }

    const result = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Ungültige Zugangsdaten' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Ungültige Zugangsdaten' });
    }

    const token = generateToken(user);
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, profile_image_url: user.profile_image_url },
    });
  } catch (err) {
    console.error('Fehler bei Login:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const userResult = await db.query(
      'SELECT id, email, name, profile_image_url, created_at FROM users WHERE id = $1',
      [req.user.userId]
    );
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User nicht gefunden' });

    const user = userResult.rows[0];

    // WG-Mitgliedschaft prüfen
    const wgResult = await db.query(
      `SELECT w.id AS wg_id, w.name AS wg_name, w.invite_code
       FROM wg_members m
       JOIN wgs w ON w.id = m.wg_id
       WHERE m.user_id = $1
       LIMIT 1`,
      [req.user.userId]
    );

    res.json({
      ...user,
      wg: wgResult.rows[0] || null,
    });
  } catch (err) {
    console.error('Fehler bei GET /auth/me:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// PATCH /api/auth/profile
router.patch('/profile', requireAuth, upload.single('profile_image'), async (req, res) => {
  try {
    const { name } = req.body;
    const fields = [];
    const params = [];

    if (name) {
      params.push(name);
      fields.push(`name = $${params.length}`);
    }
    if (req.file) {
      params.push(`/uploads/profiles/${req.file.filename}`);
      fields.push(`profile_image_url = $${params.length}`);
    }
    if (fields.length === 0) return res.status(400).json({ error: 'Keine Änderungen' });

    params.push(req.user.userId);
    const result = await db.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING id, email, name, profile_image_url`,
      params
    );
    res.json({ user: result.rows[0] });
  } catch (err) {
    console.error('Fehler bei PATCH /auth/profile:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

module.exports = router;
