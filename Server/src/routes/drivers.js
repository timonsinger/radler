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

    // Freischaltungs-Check beim Online-Gehen
    if (is_online) {
      const approvalResult = await db.query(
        'SELECT is_approved FROM drivers WHERE user_id = $1',
        [req.user.userId]
      );
      if (approvalResult.rows.length > 0 && !approvalResult.rows[0].is_approved) {
        return res.status(403).json({ error: 'Dein Account wurde noch nicht freigeschaltet. Bitte warte auf die Admin-Bestätigung.' });
      }
    }

    await db.query(
      `UPDATE drivers SET is_online = $1, last_online = ${is_online ? 'NOW()' : 'last_online'} WHERE user_id = $2`,
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
      `SELECT COUNT(*) AS completed_rides, COALESCE(SUM(COALESCE(driver_payout, price * 0.85)), 0) AS earnings_today
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

    const reviewCountResult = await db.query(
      "SELECT COUNT(*) AS total FROM rides WHERE driver_id = $1 AND rating IS NOT NULL",
      [req.user.userId]
    );

    const stats = {
      completed_rides: parseInt(ridesResult.rows[0].completed_rides, 10),
      earnings_today: parseFloat(ridesResult.rows[0].earnings_today),
      average_rating: ratingResult.rows[0]?.rating || null,
      total_reviews: parseInt(reviewCountResult.rows[0].total, 10),
    };

    res.json({ stats });
  } catch (err) {
    console.error('Fehler bei GET /drivers/stats:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// PATCH /api/drivers/profile – Fahrerprofil bearbeiten
router.patch('/profile', requireDriver, async (req, res) => {
  try {
    const { vehicle_type, description, availability } = req.body;
    const fields = [];
    const params = [];

    if (vehicle_type && ['bicycle', 'cargo_bike'].includes(vehicle_type)) {
      params.push(vehicle_type);
      fields.push(`vehicle_type = $${params.length}`);
    }
    if (description !== undefined) {
      const desc = (description || '').substring(0, 200);
      params.push(desc || null);
      fields.push(`description = $${params.length}`);
    }
    if (availability !== undefined) {
      const avail = (availability || '').substring(0, 100);
      params.push(avail || null);
      fields.push(`availability = $${params.length}`);
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Keine Änderungen angegeben' });
    }

    params.push(req.user.userId);
    const result = await db.query(
      `UPDATE drivers SET ${fields.join(', ')} WHERE user_id = $${params.length} RETURNING vehicle_type, description, availability`,
      params
    );

    res.json({ driver: result.rows[0] });
  } catch (err) {
    console.error('Fehler bei PATCH /drivers/profile:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// GET /api/drivers/profile – Eigenes Fahrerprofil laden
router.get('/profile', requireDriver, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT vehicle_type, rating, description, availability FROM drivers WHERE user_id = $1',
      [req.user.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Fahrerprofil nicht gefunden' });
    }

    // Gesamt-Statistiken
    const statsResult = await db.query(
      `SELECT COUNT(*) AS total_rides, COALESCE(SUM(COALESCE(driver_payout, price * 0.85)), 0) AS total_earnings
       FROM rides WHERE driver_id = $1 AND status = 'delivered'`,
      [req.user.userId]
    );

    res.json({
      driver: result.rows[0],
      stats: {
        total_rides: parseInt(statsResult.rows[0].total_rides, 10),
        total_earnings: parseFloat(statsResult.rows[0].total_earnings),
      },
    });
  } catch (err) {
    console.error('Fehler bei GET /drivers/profile:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// GET /api/drivers/:id/reviews – Bewertungen eines Fahrers (öffentlich)
router.get('/:id/reviews', async (req, res) => {
  try {
    const { id } = req.params;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;

    // Prüfe ob Fahrer existiert
    const driverResult = await db.query(
      'SELECT rating FROM drivers WHERE user_id = $1',
      [id]
    );
    if (driverResult.rows.length === 0) {
      return res.status(404).json({ error: 'Fahrer nicht gefunden' });
    }

    // Statistiken
    const statsResult = await db.query(
      `SELECT COUNT(*) AS total,
              COUNT(CASE WHEN rating = 5 THEN 1 END) AS five,
              COUNT(CASE WHEN rating = 4 THEN 1 END) AS four,
              COUNT(CASE WHEN rating = 3 THEN 1 END) AS three,
              COUNT(CASE WHEN rating = 2 THEN 1 END) AS two,
              COUNT(CASE WHEN rating = 1 THEN 1 END) AS one
       FROM rides WHERE driver_id = $1 AND rating IS NOT NULL`,
      [id]
    );
    const stats = statsResult.rows[0];

    // Reviews laden
    const reviewsResult = await db.query(
      `SELECT r.rating, r.rating_comment, r.rated_at, u.name AS customer_name
       FROM rides r
       JOIN users u ON u.id = r.customer_id
       WHERE r.driver_id = $1 AND r.rating IS NOT NULL
       ORDER BY r.rated_at DESC NULLS LAST
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

    // Nur Vornamen zurückgeben
    const reviews = reviewsResult.rows.map(r => ({
      rating: r.rating,
      comment: r.rating_comment,
      date: r.rated_at,
      customer_name: r.customer_name ? r.customer_name.split(' ')[0] : 'Anonym',
    }));

    const total = parseInt(stats.total, 10);
    res.json({
      average_rating: driverResult.rows[0].rating ? parseFloat(driverResult.rows[0].rating) : null,
      total_reviews: total,
      distribution: {
        5: parseInt(stats.five, 10),
        4: parseInt(stats.four, 10),
        3: parseInt(stats.three, 10),
        2: parseInt(stats.two, 10),
        1: parseInt(stats.one, 10),
      },
      reviews,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('Fehler bei GET /drivers/:id/reviews:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// PATCH /api/drivers/onboarding-complete – Onboarding abschließen
router.patch('/onboarding-complete', requireDriver, async (req, res) => {
  try {
    await db.query(
      'UPDATE drivers SET onboarding_completed = true WHERE user_id = $1',
      [req.user.userId]
    );
    res.json({ onboarding_completed: true });
  } catch (err) {
    console.error('Fehler bei PATCH /drivers/onboarding-complete:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

module.exports = router;
