const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const { getIO } = require('../sockets');
const { shouldSendToCustomer, clearRide } = require('../locationThrottle');

const router = express.Router();

// Alle Routen brauchen Auth
router.use(authMiddleware);

// Upload-Verzeichnis
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    cb(null, `${req.params.id}_${Date.now()}.jpg`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Nur Bilder erlaubt'));
    }
    cb(null, true);
  },
});

// Preisberechnung: Grundgebühr + km-Preis, mit Mindestpreis
function calculatePrice(vehicleType, distanceKm) {
  const distance = parseFloat(distanceKm) || 0;
  if (vehicleType === 'bicycle') {
    return Math.max(5.50, 4.00 + distance * 1.50);
  } else if (vehicleType === 'cargo_bike') {
    return Math.max(8.00, 6.00 + distance * 2.00);
  }
  return 5.50;
}

// Haversine-Formel: Entfernung zwischen zwei GPS-Koordinaten in km
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// POST /api/rides – Neuen Auftrag erstellen
router.post('/', async (req, res) => {
  try {
    if (req.user.role !== 'customer') {
      return res.status(403).json({ error: 'Nur Kunden können Aufträge erstellen' });
    }

    const {
      pickup_address,
      pickup_lat,
      pickup_lng,
      dropoff_address,
      dropoff_lat,
      dropoff_lng,
      vehicle_type,
      distance_km,
      invite_email,
      invite_role,
      pickup_method,
      pickup_code,
      delivery_method,
      delivery_code,
    } = req.body;

    if (!pickup_address || !pickup_lat || !pickup_lng) {
      return res.status(400).json({ error: 'Abholadresse fehlt oder ist unvollständig' });
    }
    if (!dropoff_address || !dropoff_lat || !dropoff_lng) {
      return res.status(400).json({ error: 'Zieladresse fehlt oder ist unvollständig' });
    }
    if (!vehicle_type || !['bicycle', 'cargo_bike'].includes(vehicle_type)) {
      return res.status(400).json({ error: 'Fahrzeugtyp muss bicycle oder cargo_bike sein' });
    }

    // Pickup/Delivery Method validieren
    const pMethod = pickup_method || 'code';
    const dMethod = delivery_method || 'code';
    if (!['code', 'photo'].includes(pMethod)) {
      return res.status(400).json({ error: 'pickup_method muss code oder photo sein' });
    }
    if (!['code', 'photo'].includes(dMethod)) {
      return res.status(400).json({ error: 'delivery_method muss code oder photo sein' });
    }
    if (pMethod === 'code' && (!pickup_code || !/^\d{4}$/.test(pickup_code))) {
      return res.status(400).json({ error: 'pickup_code muss 4 Ziffern sein' });
    }
    if (dMethod === 'code' && (!delivery_code || !/^\d{4}$/.test(delivery_code))) {
      return res.status(400).json({ error: 'delivery_code muss 4 Ziffern sein' });
    }

    const price = calculatePrice(vehicle_type, distance_km);
    const platformFee = parseFloat((price * 0.15).toFixed(2));
    const driverPayout = parseFloat((price * 0.85).toFixed(2));

    const rideResult = await db.query(
      `INSERT INTO rides
        (customer_id, vehicle_type, pickup_address, pickup_lat, pickup_lng,
         dropoff_address, dropoff_lat, dropoff_lng, distance_km, price,
         platform_fee, driver_payout,
         invite_email, invite_role,
         pickup_method, pickup_code, delivery_method, delivery_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING *`,
      [
        req.user.userId,
        vehicle_type,
        pickup_address,
        pickup_lat,
        pickup_lng,
        dropoff_address,
        dropoff_lat,
        dropoff_lng,
        distance_km || null,
        price.toFixed(2),
        platformFee,
        driverPayout,
        invite_email || null,
        invite_role || null,
        pMethod,
        pMethod === 'code' ? pickup_code : null,
        dMethod,
        dMethod === 'code' ? delivery_code : null,
      ]
    );
    const ride = rideResult.rows[0];

    if (invite_email && invite_role) {
      const token = uuidv4();
      await db.query(
        `INSERT INTO invite_tokens (ride_id, email, token, role)
         VALUES ($1, $2, $3, $4)`,
        [ride.id, invite_email, token, invite_role]
      );
      console.log(`Einladungs-Token erstellt für ${invite_email} (Rolle: ${invite_role}), Ride: ${ride.id}`);
    }

    console.log(`Neuer Auftrag erstellt: ${ride.id} | ${vehicle_type} | ${pickup_address} → ${dropoff_address} | ${price.toFixed(2)}€`);

    // Nur passende Fahrer benachrichtigen (Radius-Filterung)
    try {
      const io = getIO();
      const driversResult = await db.query(
        `SELECT d.user_id, d.latitude, d.longitude, d.max_pickup_radius_km, d.max_ride_distance_km
         FROM drivers d
         WHERE d.is_online = true
           AND d.vehicle_type = $1
           AND d.latitude IS NOT NULL
           AND d.longitude IS NOT NULL`,
        [vehicle_type]
      );

      const pLat = parseFloat(pickup_lat);
      const pLng = parseFloat(pickup_lng);
      const rideDist = parseFloat(distance_km) || 0;

      let notified = 0;
      for (const driver of driversResult.rows) {
        const maxPickup = parseFloat(driver.max_pickup_radius_km) || 10;
        const maxRide = parseFloat(driver.max_ride_distance_km) || 20;
        const pickupDist = haversineDistance(
          parseFloat(driver.latitude), parseFloat(driver.longitude),
          pLat, pLng
        );

        if (pickupDist <= maxPickup && rideDist <= maxRide) {
          io.to(`user:${driver.user_id}`).emit('ride:new', { ride });
          notified++;
        }
      }
      console.log(`Auftrag ${ride.id}: ${notified} Fahrer benachrichtigt`);
    } catch (socketErr) {
      console.error('Socket.io Fehler bei ride:new:', socketErr.message);
    }

    res.status(201).json({ ride, price });
  } catch (err) {
    console.error('Fehler bei POST /rides:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// GET /api/rides – Aufträge laden
router.get('/', async (req, res) => {
  try {
    let result;

    if (req.user.role === 'customer') {
      result = await db.query(
        `SELECT * FROM rides WHERE customer_id = $1
         ORDER BY created_at DESC LIMIT 50`,
        [req.user.userId]
      );
    } else if (req.user.role === 'driver') {
      result = await db.query(
        `SELECT * FROM rides
         WHERE status = 'pending'
            OR (driver_id = $1 AND status IN ('accepted', 'picked_up'))
         ORDER BY created_at DESC`,
        [req.user.userId]
      );
    } else {
      return res.status(403).json({ error: 'Ungültige Rolle' });
    }

    res.json({ rides: result.rows });
  } catch (err) {
    console.error('Fehler bei GET /rides:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// GET /api/rides/history – Paginierte Auftragshistorie
router.get('/history', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    let countQuery, dataQuery;

    if (req.user.role === 'customer') {
      countQuery = await db.query(
        "SELECT COUNT(*) AS total FROM rides WHERE customer_id = $1 AND status IN ('delivered', 'cancelled', 'expired')",
        [req.user.userId]
      );
      dataQuery = await db.query(
        `SELECT r.*, u.name AS driver_name
         FROM rides r
         LEFT JOIN users u ON u.id = r.driver_id
         WHERE r.customer_id = $1 AND r.status IN ('delivered', 'cancelled')
         ORDER BY r.created_at DESC
         LIMIT $2 OFFSET $3`,
        [req.user.userId, limit, offset]
      );
    } else if (req.user.role === 'driver') {
      countQuery = await db.query(
        "SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN status = 'delivered' THEN COALESCE(driver_payout, price * 0.85) ELSE 0 END), 0) AS total_earnings FROM rides WHERE driver_id = $1 AND status IN ('delivered', 'cancelled', 'expired')",
        [req.user.userId]
      );
      dataQuery = await db.query(
        `SELECT r.*, u.name AS customer_name
         FROM rides r
         LEFT JOIN users u ON u.id = r.customer_id
         WHERE r.driver_id = $1 AND r.status IN ('delivered', 'cancelled')
         ORDER BY r.created_at DESC
         LIMIT $2 OFFSET $3`,
        [req.user.userId, limit, offset]
      );
    } else {
      return res.status(403).json({ error: 'Ungültige Rolle' });
    }

    const total = parseInt(countQuery.rows[0].total, 10);
    const totalEarnings = countQuery.rows[0].total_earnings || 0;
    res.json({
      rides: dataQuery.rows,
      total,
      totalEarnings: parseFloat(totalEarnings),
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('Fehler bei GET /rides/history:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// GET /api/rides/:id – Einzelnen Auftrag laden
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT r.*,
              c.name AS customer_name,
              d.name AS driver_name
       FROM rides r
       JOIN users c ON c.id = r.customer_id
       LEFT JOIN users d ON d.id = r.driver_id
       WHERE r.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Auftrag nicht gefunden' });
    }

    const ride = result.rows[0];

    const isCustomer = ride.customer_id === req.user.userId;
    const isDriver = ride.driver_id === req.user.userId;
    const isPendingForDriver = ride.status === 'pending' && req.user.role === 'driver';

    if (!isCustomer && !isDriver && !isPendingForDriver) {
      return res.status(403).json({ error: 'Kein Zugriff auf diesen Auftrag' });
    }

    res.json({ ride });
  } catch (err) {
    console.error('Fehler bei GET /rides/:id:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// PATCH /api/rides/:id/accept – Fahrer nimmt Auftrag an
router.patch('/:id/accept', async (req, res) => {
  try {
    if (req.user.role !== 'driver') {
      return res.status(403).json({ error: 'Nur Fahrer können Aufträge annehmen' });
    }

    const { id } = req.params;

    const rideResult = await db.query('SELECT * FROM rides WHERE id = $1', [id]);
    if (rideResult.rows.length === 0) {
      return res.status(404).json({ error: 'Auftrag nicht gefunden' });
    }
    const ride = rideResult.rows[0];

    if (ride.status !== 'pending') {
      return res.status(409).json({ error: 'Auftrag ist nicht mehr verfügbar' });
    }

    const driverResult = await db.query(
      'SELECT * FROM drivers WHERE user_id = $1',
      [req.user.userId]
    );
    if (driverResult.rows.length === 0) {
      return res.status(404).json({ error: 'Fahrerprofil nicht gefunden' });
    }
    const driver = driverResult.rows[0];

    if (!driver.is_online) {
      return res.status(400).json({ error: 'Du musst online sein um Aufträge anzunehmen' });
    }

    if (driver.vehicle_type && driver.vehicle_type !== ride.vehicle_type) {
      return res.status(400).json({ error: `Auftrag erfordert ${ride.vehicle_type}` });
    }

    if (!driver.vehicle_type) {
      await db.query(
        'UPDATE drivers SET vehicle_type = $1 WHERE user_id = $2',
        [ride.vehicle_type, req.user.userId]
      );
    }

    const updatedRideResult = await db.query(
      `UPDATE rides
       SET driver_id = $1, status = 'accepted', accepted_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [req.user.userId, id]
    );
    const updatedRide = updatedRideResult.rows[0];

    const driverUserResult = await db.query(
      'SELECT id, name, phone FROM users WHERE id = $1',
      [req.user.userId]
    );
    const driverInfo = {
      ...driverUserResult.rows[0],
      vehicle_type: ride.vehicle_type,
      rating: driver.rating,
    };

    console.log(`Auftrag ${id} angenommen von Fahrer ${req.user.userId}`);

    try {
      const io = getIO();
      io.to(`user:${ride.customer_id}`).emit('ride:accepted', {
        ride: updatedRide,
        driver: driverInfo,
      });
      io.to(`drivers:${ride.vehicle_type}`).emit('ride:removed', { rideId: id });
    } catch (socketErr) {
      console.error('Socket.io Fehler bei ride:accepted:', socketErr.message);
    }

    res.json({ ride: updatedRide });
  } catch (err) {
    console.error('Fehler bei PATCH /rides/:id/accept:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// POST /api/rides/:id/photo – Ablieferungsfoto hochladen
router.post('/:id/photo', upload.single('photo'), async (req, res) => {
  try {
    if (req.user.role !== 'driver') {
      return res.status(403).json({ error: 'Nur Fahrer können Fotos hochladen' });
    }

    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'Kein Foto hochgeladen' });
    }

    const rideResult = await db.query('SELECT * FROM rides WHERE id = $1', [id]);
    if (rideResult.rows.length === 0) {
      return res.status(404).json({ error: 'Auftrag nicht gefunden' });
    }
    const ride = rideResult.rows[0];

    if (ride.driver_id !== req.user.userId) {
      return res.status(403).json({ error: 'Du bist nicht der zugewiesene Fahrer' });
    }

    if (!['accepted', 'picked_up'].includes(ride.status)) {
      return res.status(400).json({ error: 'Foto nur bei aktivem Auftrag möglich' });
    }

    const photoUrl = `/uploads/${req.file.filename}`;
    await db.query(
      'UPDATE rides SET delivery_photo_url = $1 WHERE id = $2',
      [photoUrl, id]
    );

    console.log(`Foto hochgeladen für Auftrag ${id}: ${photoUrl}`);
    res.json({ delivery_photo_url: photoUrl });
  } catch (err) {
    console.error('Fehler bei POST /rides/:id/photo:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// PATCH /api/rides/:id/status – Status ändern
router.patch('/:id/status', async (req, res) => {
  try {
    if (req.user.role !== 'driver') {
      return res.status(403).json({ error: 'Nur Fahrer können den Status ändern' });
    }

    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['picked_up', 'delivered'].includes(status)) {
      return res.status(400).json({ error: 'Ungültiger Status. Erlaubt: picked_up, delivered' });
    }

    const rideResult = await db.query('SELECT * FROM rides WHERE id = $1', [id]);
    if (rideResult.rows.length === 0) {
      return res.status(404).json({ error: 'Auftrag nicht gefunden' });
    }
    const ride = rideResult.rows[0];

    if (ride.driver_id !== req.user.userId) {
      return res.status(403).json({ error: 'Du bist nicht der zugewiesene Fahrer' });
    }

    const validTransitions = {
      accepted: 'picked_up',
      picked_up: 'delivered',
    };
    if (validTransitions[ride.status] !== status) {
      return res.status(400).json({
        error: `Ungültiger Statusübergang: ${ride.status} → ${status}`,
      });
    }

    // Pickup-Verifizierung prüfen
    if (status === 'picked_up') {
      if (ride.pickup_method === 'code' && !ride.pickup_code_confirmed) {
        return res.status(400).json({ error: 'Abhol-Code muss zuerst bestätigt werden' });
      }
      if (ride.pickup_method === 'photo' && !ride.pickup_photo_url) {
        return res.status(400).json({ error: 'Bitte zuerst ein Foto der Abholung machen' });
      }
    }

    // Delivery-Verifizierung prüfen
    if (status === 'delivered') {
      if (ride.delivery_method === 'code' && !ride.delivery_code_confirmed) {
        return res.status(400).json({ error: 'Übergabe-Code muss zuerst bestätigt werden' });
      }
      if (ride.delivery_method === 'photo' && !ride.delivery_photo_url) {
        return res.status(400).json({ error: 'Bitte zuerst ein Foto der Ablieferung machen' });
      }
    }

    const updatedRideResult = await db.query(
      `UPDATE rides
       SET status = $1, completed_at = ${status === 'delivered' ? 'NOW()' : 'NULL'}
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );
    const updatedRide = updatedRideResult.rows[0];

    console.log(`Auftrag ${id} Status geändert: ${ride.status} → ${status}`);

    // Throttle aufräumen wenn Ride abgeschlossen
    if (status === 'delivered') {
      clearRide(id);
    }

    try {
      const io = getIO();
      io.to(`ride:${id}`).emit('ride:status_update', {
        rideId: id,
        status,
        delivery_photo_url: updatedRide.delivery_photo_url,
      });
    } catch (socketErr) {
      console.error('Socket.io Fehler bei ride:status_update:', socketErr.message);
    }

    res.json({ ride: updatedRide });
  } catch (err) {
    console.error('Fehler bei PATCH /rides/:id/status:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// PATCH /api/rides/:id/cancel – Auftrag stornieren
router.patch('/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;

    const rideResult = await db.query('SELECT * FROM rides WHERE id = $1', [id]);
    if (rideResult.rows.length === 0) {
      return res.status(404).json({ error: 'Auftrag nicht gefunden' });
    }
    const ride = rideResult.rows[0];

    if (!['pending', 'accepted'].includes(ride.status)) {
      return res.status(400).json({ error: 'Dieser Auftrag kann nicht mehr storniert werden' });
    }

    const isCustomer = ride.customer_id === req.user.userId;
    const isAssignedDriver = ride.driver_id === req.user.userId;
    if (!isCustomer && !isAssignedDriver) {
      return res.status(403).json({ error: 'Kein Zugriff auf diesen Auftrag' });
    }

    const updatedRideResult = await db.query(
      `UPDATE rides SET status = 'cancelled' WHERE id = $1 RETURNING *`,
      [id]
    );
    const updatedRide = updatedRideResult.rows[0];

    console.log(`Auftrag ${id} storniert von User ${req.user.userId}`);
    clearRide(id);

    try {
      const io = getIO();
      io.to(`user:${ride.customer_id}`).emit('ride:status_update', {
        rideId: id,
        status: 'cancelled',
      });
      if (ride.driver_id) {
        io.to(`user:${ride.driver_id}`).emit('ride:status_update', {
          rideId: id,
          status: 'cancelled',
        });
      }
    } catch (socketErr) {
      console.error('Socket.io Fehler bei ride:cancel:', socketErr.message);
    }

    res.json({ ride: updatedRide });
  } catch (err) {
    console.error('Fehler bei PATCH /rides/:id/cancel:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// POST /api/rides/:id/verify-pickup – Abhol-Code bestätigen
router.post('/:id/verify-pickup', async (req, res) => {
  try {
    if (req.user.role !== 'driver') {
      return res.status(403).json({ error: 'Nur Fahrer können Codes bestätigen' });
    }
    const { id } = req.params;
    const { code } = req.body;

    const rideResult = await db.query('SELECT * FROM rides WHERE id = $1', [id]);
    if (rideResult.rows.length === 0) return res.status(404).json({ error: 'Auftrag nicht gefunden' });
    const ride = rideResult.rows[0];

    if (ride.driver_id !== req.user.userId) return res.status(403).json({ error: 'Du bist nicht der zugewiesene Fahrer' });
    if (ride.pickup_method !== 'code') return res.status(400).json({ error: 'Dieser Auftrag verwendet keinen Abhol-Code' });
    if (ride.status !== 'accepted') return res.status(400).json({ error: 'Auftrag ist nicht im Status accepted' });

    if (code !== ride.pickup_code) {
      return res.status(400).json({ error: 'Falscher Code' });
    }

    await db.query('UPDATE rides SET pickup_code_confirmed = true WHERE id = $1', [id]);
    console.log(`Abhol-Code bestätigt für Auftrag ${id}`);
    res.json({ verified: true });
  } catch (err) {
    console.error('Fehler bei POST /rides/:id/verify-pickup:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// POST /api/rides/:id/verify-delivery – Übergabe-Code bestätigen
router.post('/:id/verify-delivery', async (req, res) => {
  try {
    if (req.user.role !== 'driver') {
      return res.status(403).json({ error: 'Nur Fahrer können Codes bestätigen' });
    }
    const { id } = req.params;
    const { code } = req.body;

    const rideResult = await db.query('SELECT * FROM rides WHERE id = $1', [id]);
    if (rideResult.rows.length === 0) return res.status(404).json({ error: 'Auftrag nicht gefunden' });
    const ride = rideResult.rows[0];

    if (ride.driver_id !== req.user.userId) return res.status(403).json({ error: 'Du bist nicht der zugewiesene Fahrer' });
    if (ride.delivery_method !== 'code') return res.status(400).json({ error: 'Dieser Auftrag verwendet keinen Übergabe-Code' });
    if (ride.status !== 'picked_up') return res.status(400).json({ error: 'Auftrag ist nicht im Status picked_up' });

    if (code !== ride.delivery_code) {
      return res.status(400).json({ error: 'Falscher Code' });
    }

    await db.query('UPDATE rides SET delivery_code_confirmed = true WHERE id = $1', [id]);
    console.log(`Übergabe-Code bestätigt für Auftrag ${id}`);
    res.json({ verified: true });
  } catch (err) {
    console.error('Fehler bei POST /rides/:id/verify-delivery:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// POST /api/rides/:id/pickup-photo – Abholungsfoto hochladen
router.post('/:id/pickup-photo', upload.single('photo'), async (req, res) => {
  try {
    if (req.user.role !== 'driver') {
      return res.status(403).json({ error: 'Nur Fahrer können Fotos hochladen' });
    }
    const { id } = req.params;
    if (!req.file) return res.status(400).json({ error: 'Kein Foto hochgeladen' });

    const rideResult = await db.query('SELECT * FROM rides WHERE id = $1', [id]);
    if (rideResult.rows.length === 0) return res.status(404).json({ error: 'Auftrag nicht gefunden' });
    const ride = rideResult.rows[0];

    if (ride.driver_id !== req.user.userId) return res.status(403).json({ error: 'Du bist nicht der zugewiesene Fahrer' });
    if (ride.status !== 'accepted') return res.status(400).json({ error: 'Foto nur bei Status accepted möglich' });

    const photoUrl = `/uploads/${req.file.filename}`;
    await db.query('UPDATE rides SET pickup_photo_url = $1 WHERE id = $2', [photoUrl, id]);

    console.log(`Abhol-Foto hochgeladen für Auftrag ${id}: ${photoUrl}`);
    res.json({ pickup_photo_url: photoUrl });
  } catch (err) {
    console.error('Fehler bei POST /rides/:id/pickup-photo:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// GET /api/rides/:id/rating – Bewertung eines Auftrags abfragen
router.get('/:id/rating', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT rating, rating_comment, rated_at FROM rides WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Auftrag nicht gefunden' });
    const { rating, rating_comment, rated_at } = result.rows[0];
    res.json({ rating: rating || null, rating_comment: rating_comment || null, rated_at: rated_at || null });
  } catch (err) {
    console.error('Fehler bei GET /rides/:id/rating:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// POST /api/rides/:id/rating – Bewertung abgeben
router.post('/:id/rating', async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Bewertung muss zwischen 1 und 5 liegen' });
    }
    if (comment && comment.length > 500) {
      return res.status(400).json({ error: 'Kommentar darf maximal 500 Zeichen lang sein' });
    }

    const rideResult = await db.query('SELECT * FROM rides WHERE id = $1', [id]);
    if (rideResult.rows.length === 0) return res.status(404).json({ error: 'Auftrag nicht gefunden' });
    const ride = rideResult.rows[0];

    if (ride.customer_id !== req.user.userId) return res.status(403).json({ error: 'Kein Zugriff' });
    if (ride.status !== 'delivered') return res.status(400).json({ error: 'Nur zugestellte Aufträge können bewertet werden' });
    if (ride.rating) return res.status(400).json({ error: 'Auftrag wurde bereits bewertet' });

    await db.query(
      'UPDATE rides SET rating = $1, rating_comment = $2, rated_at = NOW() WHERE id = $3',
      [rating, comment || null, id]
    );

    // Fahrer-Durchschnitt aktualisieren
    let updatedDriverRating = null;
    if (ride.driver_id) {
      const avgResult = await db.query(
        "SELECT AVG(rating)::DECIMAL(3,2) AS avg_rating FROM rides WHERE driver_id = $1 AND rating IS NOT NULL",
        [ride.driver_id]
      );
      if (avgResult.rows[0]?.avg_rating) {
        updatedDriverRating = parseFloat(avgResult.rows[0].avg_rating);
        await db.query('UPDATE drivers SET rating = $1 WHERE user_id = $2', [updatedDriverRating, ride.driver_id]);
      }

      // Socket Event an Fahrer senden
      try {
        const io = getIO();
        io.to(`user:${ride.driver_id}`).emit('ride:rated', {
          rideId: id,
          rating,
          comment: comment || null,
        });
      } catch (socketErr) {
        console.error('Socket.io Fehler bei ride:rated:', socketErr.message);
      }
    }

    console.log(`Bewertung für Auftrag ${id}: ${rating} Sterne`);
    res.json({ rating, rating_comment: comment || null, driver_rating: updatedDriverRating });
  } catch (err) {
    console.error('Fehler bei POST /rides/:id/rating:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

module.exports = router;
