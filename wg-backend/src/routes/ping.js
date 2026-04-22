const { Router } = require('express');
const db = require('../db');

const router = Router();

// GET /api/ping — Test-Endpoint mit DB-Zähler
router.get('/', async (req, res) => {
  try {
    await db.query('INSERT INTO ping_log DEFAULT VALUES');
    const result = await db.query('SELECT COUNT(*) AS total FROM ping_log');
    res.json({
      message: 'pong',
      timestamp: new Date().toISOString(),
      total_pings: parseInt(result.rows[0].total, 10),
    });
  } catch (err) {
    console.error('Fehler bei GET /api/ping:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

module.exports = router;
