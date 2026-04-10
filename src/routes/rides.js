const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const { getIO } = require('../sockets');

const router = express.Router();

// Alle Routen brauchen Auth
router.use(authMiddleware);

// Preisberechnung für einen Auftrag
function calculatePrice(vehicleType, distanceKm) {
  const distance = parseFloat(distanceKm) || 0;
  if (vehicleType === 'bicycle') {
    return Math.max(3.00, distance * 1.50);
  } else if (vehicleType === 'cargo_bike') {
    return Math.max(4.00, distance * 2.00);
  }
  return 3.00;
}

// POST /api/rides – Neuen Auftrag erstellen
router.post('/', async (req, res) => {
  try {
    // Nur Kunden dürfen Aufträge erstellen
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
    } = req.body;

    // Eingaben validieren
    if (!pickup_address || !pickup_lat || !pickup_lng) {
      return res.status(400).json({ error: 'Abholadresse fehlt oder ist unvollständig' });
    }
    if (!dropoff_address || !dropoff_lat || !dropoff_lng) {
      return res.status(400).json({ error: 'Zieladresse fehlt oder ist unvollständig' });
    }
    if (!vehicle_type || !['bicycle', 'cargo_bike'].includes(vehicle_type)) {
      return res.status(400).json({ error: 'Fahrzeugtyp muss bicycle oder cargo_bike sein' });
    }

    // Preis berechnen
    const price = calculatePrice(vehicle_type, distance_km);

    // Ride in DB einfügen
    const rideResult = await db.query(
      `INSERT INTO rides
        (customer_id, vehicle_type, pickup_address, pickup_lat, pickup_lng,
         dropoff_address, dropoff_lat, dropoff_lng, distance_km, price,
         invite_email, invite_role)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
        invite_email || null,
        invite_role || null,
      ]
    );
    const ride = rideResult.rows[0];

    // Einladungs-Token erstellen falls invite_email gesetzt
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

    // Socket.io: Event an alle online Fahrer mit passendem vehicle_type senden
    try {
      const io = getIO();
      io.to(`drivers:${vehicle_type}`).emit('ride:new', { ride });
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
      // Kunden sehen nur eigene Rides
      result = await db.query(
        `SELECT * FROM rides WHERE customer_id = $1
         ORDER BY created_at DESC LIMIT 50`,
        [req.user.userId]
      );
    } else if (req.user.role === 'driver') {
      // Fahrer sehen offene Aufträge + eigene aktiven Rides
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

    // Zugriffsberechtigung prüfen
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

    // Ride laden
    const rideResult = await db.query('SELECT * FROM rides WHERE id = $1', [id]);
    if (rideResult.rows.length === 0) {
      return res.status(404).json({ error: 'Auftrag nicht gefunden' });
    }
    const ride = rideResult.rows[0];

    if (ride.status !== 'pending') {
      return res.status(409).json({ error: 'Auftrag ist nicht mehr verfügbar' });
    }

    // Fahrer-Daten laden
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

    // Fahrzeugtyp prüfen
    if (driver.vehicle_type && driver.vehicle_type !== ride.vehicle_type) {
      return res.status(400).json({ error: `Auftrag erfordert ${ride.vehicle_type}` });
    }

    // Falls vehicle_type noch nicht gesetzt: jetzt setzen
    if (!driver.vehicle_type) {
      await db.query(
        'UPDATE drivers SET vehicle_type = $1 WHERE user_id = $2',
        [ride.vehicle_type, req.user.userId]
      );
      console.log(`Fahrzeugtyp für Fahrer ${req.user.userId} gesetzt: ${ride.vehicle_type}`);
    }

    // Ride annehmen
    const updatedRideResult = await db.query(
      `UPDATE rides
       SET driver_id = $1, status = 'accepted', accepted_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [req.user.userId, id]
    );
    const updatedRide = updatedRideResult.rows[0];

    // Fahrer-Info für Socket-Event holen
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

    // Socket.io Events senden
    try {
      const io = getIO();
      // Kunden informieren
      io.to(`user:${ride.customer_id}`).emit('ride:accepted', {
        ride: updatedRide,
        driver: driverInfo,
      });
      // Anderen Fahrern: Ride aus der Liste nehmen
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

    // Ride laden
    const rideResult = await db.query('SELECT * FROM rides WHERE id = $1', [id]);
    if (rideResult.rows.length === 0) {
      return res.status(404).json({ error: 'Auftrag nicht gefunden' });
    }
    const ride = rideResult.rows[0];

    // Prüfen ob Fahrer für diesen Ride zugewiesen ist
    if (ride.driver_id !== req.user.userId) {
      return res.status(403).json({ error: 'Du bist nicht der zugewiesene Fahrer' });
    }

    // Statusübergang validieren
    const validTransitions = {
      accepted: 'picked_up',
      picked_up: 'delivered',
    };
    if (validTransitions[ride.status] !== status) {
      return res.status(400).json({
        error: `Ungültiger Statusübergang: ${ride.status} → ${status}`,
      });
    }

    // Status aktualisieren
    const completedAt = status === 'delivered' ? 'NOW()' : 'NULL';
    const updatedRideResult = await db.query(
      `UPDATE rides
       SET status = $1, completed_at = ${completedAt === 'NULL' ? 'NULL' : 'NOW()'}
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );
    const updatedRide = updatedRideResult.rows[0];

    console.log(`Auftrag ${id} Status geändert: ${ride.status} → ${status}`);

    // Socket.io: Kunden informieren
    try {
      const io = getIO();
      io.to(`ride:${id}`).emit('ride:status_update', {
        rideId: id,
        status,
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

    // Ride laden
    const rideResult = await db.query('SELECT * FROM rides WHERE id = $1', [id]);
    if (rideResult.rows.length === 0) {
      return res.status(404).json({ error: 'Auftrag nicht gefunden' });
    }
    const ride = rideResult.rows[0];

    // Nur pending oder accepted darf storniert werden
    if (!['pending', 'accepted'].includes(ride.status)) {
      return res.status(400).json({ error: 'Dieser Auftrag kann nicht mehr storniert werden' });
    }

    // Berechtigung prüfen: Kunde oder zugewiesener Fahrer
    const isCustomer = ride.customer_id === req.user.userId;
    const isAssignedDriver = ride.driver_id === req.user.userId;
    if (!isCustomer && !isAssignedDriver) {
      return res.status(403).json({ error: 'Kein Zugriff auf diesen Auftrag' });
    }

    // Status auf cancelled setzen
    const updatedRideResult = await db.query(
      `UPDATE rides SET status = 'cancelled' WHERE id = $1 RETURNING *`,
      [id]
    );
    const updatedRide = updatedRideResult.rows[0];

    console.log(`Auftrag ${id} storniert von User ${req.user.userId}`);

    // Socket.io: Betroffene Parteien informieren
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

module.exports = router;
