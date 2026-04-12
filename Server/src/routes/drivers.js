const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const { getIO } = require('../sockets');

const router = express.Router();

// Alle Routen brauchen Auth
router.use(authMiddleware);

// Hilfsmiddleware: nur Fahrer
function requireDriver(req, res, next) {
  if (req.user.role !== 'driver') {
    return res.status(403).json({ error: 'Nur Fahrer können diese Route verwenden' });
  }
  next();
}

// GET /api/drivers/available – Verfügbare Fahrer (für Kunden, kein requireDriver)
router.get('/available', async (req, res) => {
  try {
    const { vehicle_type } = req.query;

    let query = `
      SELECT d.id, d.latitude, d.longitude, d.vehicle_type, d.rating
      FROM drivers d
      WHERE d.is_online = true
        AND d.latitude IS NOT NULL
        AND d.longitude IS NOT NULL
    `;
    const params = [];

    if (vehicle_type && ['bicycle', 'cargo_bike'].includes(vehicle_type)) {
      params.push(vehicle_type);
      query += ` AND d.vehicle_type = $${params.length}`;
    }

    const result = await db.query(query, params);
    res.json({ drivers: result.rows });
  } catch (err) {
    console.error('Fehler bei GET /drivers/available:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// GET /api/drivers/settings – Einstellungen laden
router.get('/settings', requireDriver, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT max_pickup_radius_km, max_ride_distance_km FROM drivers WHERE user_id = $1',
      [req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fahrerprofil nicht gefunden' });
    }
    res.json({
      max_pickup_radius_km: parseFloat(result.rows[0].max_pickup_radius_km) || 10,
      max_ride_distance_km: parseFloat(result.rows[0].max_ride_distance_km) || 20,
    });
  } catch (err) {
    console.error('Fehler bei GET /drivers/settings:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// PATCH /api/drivers/settings – Einstellungen speichern
router.patch('/settings', requireDriver, async (req, res) => {
  try {
    const { max_pickup_radius_km, max_ride_distance_km } = req.body;

    if (max_pickup_radius_km == null && max_ride_distance_km == null) {
      return res.status(400).json({ error: 'Mindestens ein Wert erforderlich' });
    }

    const fields = [];
    const params = [];

    if (max_pickup_radius_km != null) {
      const val = parseFloat(max_pickup_radius_km);
      if (isNaN(val) || val < 1 || val > 30) {
        return res.status(400).json({ error: 'max_pickup_radius_km muss zwischen 1 und 30 liegen' });
      }
      params.push(val);
      fields.push(`max_pickup_radius_km = $${params.length}`);
    }

    if (max_ride_distance_km != null) {
      const val = parseFloat(max_ride_distance_km);
      if (isNaN(val) || val < 1 || val > 50) {
        return res.status(400).json({ error: 'max_ride_distance_km muss zwischen 1 und 50 liegen' });
      }
      params.push(val);
      fields.push(`max_ride_distance_km = $${params.length}`);
    }

    params.push(req.user.userId);
    await db.query(
      `UPDATE drivers SET ${fields.join(', ')} WHERE user_id = $${params.length}`,
      params
    );

    console.log(`Fahrer ${req.user.userId} Einstellungen gespeichert`);
    res.json({ max_pickup_radius_km, max_ride_distance_km });
  } catch (err) {
    console.error('Fehler bei PATCH /drivers/settings:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// PATCH /api/drivers/vehicle-type – Fahrzeugtyp setzen
router.patch('/vehicle-type', requireDriver, async (req, res) => {
  try {
    const { vehicle_type } = req.body;
    if (!vehicle_type || !['bicycle', 'cargo_bike'].includes(vehicle_type)) {
      return res.status(400).json({ error: 'vehicle_type muss bicycle oder cargo_bike sein' });
    }
    await db.query(
      'UPDATE drivers SET vehicle_type = $1 WHERE user_id = $2',
      [vehicle_type, req.user.userId]
    );
    console.log(`Fahrzeugtyp gesetzt: ${req.user.userId} → ${vehicle_type}`);
    res.json({ vehicle_type });
  } catch (err) {
    console.error('Fehler bei PATCH /drivers/vehicle-type:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// PATCH /api/drivers/status – Online/Offline-Status setzen
router.patch('/status', requireDriver, async (req, res) => {
  try {
    const { is_online } = req.body;

    if (typeof is_online !== 'boolean') {
      return res.status(400).json({ error: 'is_online muss ein Boolean sein' });
    }

    await db.query(
      'UPDATE drivers SET is_online = $1 WHERE user_id = $2',
      [is_online, req.user.userId]
    );

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
router.patch('/location', requireDriver, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: 'latitude und longitude sind erforderlich' });
    }

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

    // Nur alle 30 Sekunden an Kunden senden
    const { shouldSendToCustomer } = require('../locationThrottle');
    try {
      const io = getIO();
      for (const ride of ridesResult.rows) {
        if (shouldSendToCustomer(ride.id)) {
          io.to(`ride:${ride.id}`).emit('driver:location_update', {
            rideId: ride.id,
            latitude,
            longitude,
          });
        }
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
router.get('/stats', requireDriver, async (req, res) => {
  try {
    const ridesResult = await db.query(
      `SELECT COUNT(*) AS completed_rides, COALESCE(SUM(price), 0) AS earnings_today
       FROM rides
       WHERE driver_id = $1
         AND status = 'delivered'
         AND completed_at::date = CURRENT_DATE`,
      [req.user.userId]
    );

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
