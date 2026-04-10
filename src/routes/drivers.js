const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const { getIO } = require('../sockets');

const router = express.Router();

// Alle Routen brauchen Auth + Fahrer-Rolle
router.use(authMiddleware);
router.use((req, res, next) => {
  if (req.user.role !== 'driver') {
    return res.status(403).json({ error: 'Nur Fahrer können diese Route verwenden' });
  }
  next();
});

// PATCH /api/drivers/status – Online/Offline-Status setzen
router.patch('/status', async (req, res) => {
  try {
    const { is_online } = req.body;

    if (typeof is_online !== 'boolean') {
      return res.status(400).json({ error: 'is_online muss ein Boolean sein' });
    }

    await db.query(
      'UPDATE drivers SET is_online = $1 WHERE user_id = $2',
      [is_online, req.user.userId]
    );

    // Name für Log holen
    const userResult = await db.query('SELECT name FROM users WHERE id = $1', [req.user.userId]);
    const name = userResult.rows[0]?.name || req.user.userId;

    console.log(`Fahrer ${name} ist jetzt ${is_online ? 'online' : 'offline'}`);

    res.json({ is_online });
  } catch (err) {
    console.error('Fehler bei PATCH /drivers/status:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// PATCH /api/drivers/location – Position aktualisieren
router.patch('/location', async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: 'latitude und longitude sind erforderlich' });
    }

    // Position in DB speichern
    await db.query(
      `UPDATE drivers
       SET latitude = $1, longitude = $2, last_location_update = NOW()
       WHERE user_id = $3`,
      [latitude, longitude, req.user.userId]
    );

    // Alle aktiven Rides dieses Fahrers finden
    const ridesResult = await db.query(
      `SELECT id, customer_id FROM rides
       WHERE driver_id = $1 AND status IN ('accepted', 'picked_up')`,
      [req.user.userId]
    );

    // Für jeden aktiven Ride: Kunden per Socket benachrichtigen
    try {
      const io = getIO();
      for (const ride of ridesResult.rows) {
        io.to(`ride:${ride.id}`).emit('driver:location_update', {
          rideId: ride.id,
          latitude,
          longitude,
        });
      }
    } catch (socketErr) {
      console.error('Socket.io Fehler bei driver:location_update:', socketErr.message);
    }

    res.json({ latitude, longitude });
  } catch (err) {
    console.error('Fehler bei PATCH /drivers/location:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// GET /api/drivers/stats – Tages-Statistiken
router.get('/stats', async (req, res) => {
  try {
    // Abgeschlossene Fahrten heute
    const ridesResult = await db.query(
      `SELECT COUNT(*) AS completed_rides, COALESCE(SUM(price), 0) AS earnings_today
       FROM rides
       WHERE driver_id = $1
         AND status = 'delivered'
         AND completed_at::date = CURRENT_DATE`,
      [req.user.userId]
    );

    // Durchschnittliche Bewertung
    const ratingResult = await db.query(
      'SELECT rating FROM drivers WHERE user_id = $1',
      [req.user.userId]
    );

    const stats = {
      completed_rides: parseInt(ridesResult.rows[0].completed_rides, 10),
      earnings_today: parseFloat(ridesResult.rows[0].earnings_today),
      average_rating: ratingResult.rows[0]?.rating || null,
    };

    res.json({ stats });
  } catch (err) {
    console.error('Fehler bei GET /drivers/stats:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

module.exports = router;
