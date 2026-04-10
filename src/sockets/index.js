const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('../db');

let io;

// Gibt die Socket.io Instanz zurück (für Verwendung in Routes)
function getIO() {
  if (!io) throw new Error('Socket.io wurde noch nicht initialisiert');
  return io;
}

// Initialisiert Socket.io mit JWT-Authentifizierung
function setupSockets(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : '*',
      methods: ['GET', 'POST'],
    },
  });

  // JWT-Authentifizierung beim Verbindungsaufbau
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error('Kein Token vorhanden'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      };
      next();
    } catch (err) {
      return next(new Error('Ungültiger Token'));
    }
  });

  io.on('connection', async (socket) => {
    const { userId, role } = socket.user;
    console.log(`Socket verbunden: User ${userId} (${role})`);

    // Jeder User joined seinen persönlichen Raum
    socket.join(`user:${userId}`);

    // Event: Fahrer geht online
    socket.on('driver:go_online', async () => {
      try {
        if (role !== 'driver') return;

        // Driver-Daten laden (vehicle_type für Raum)
        const driverResult = await db.query(
          'SELECT vehicle_type FROM drivers WHERE user_id = $1',
          [userId]
        );
        const driver = driverResult.rows[0];
        const vehicleType = driver?.vehicle_type;

        // DB updaten
        await db.query(
          'UPDATE drivers SET is_online = true WHERE user_id = $1',
          [userId]
        );

        // Fahrer-Raum joinen (falls vehicle_type bekannt)
        if (vehicleType) {
          socket.join(`drivers:${vehicleType}`);
        }

        const userResult = await db.query('SELECT name FROM users WHERE id = $1', [userId]);
        const name = userResult.rows[0]?.name || userId;
        console.log(`Fahrer online: ${name}`);
      } catch (err) {
        console.error('Fehler bei driver:go_online:', err);
      }
    });

    // Event: Fahrer geht offline
    socket.on('driver:go_offline', async () => {
      try {
        if (role !== 'driver') return;

        await db.query(
          'UPDATE drivers SET is_online = false WHERE user_id = $1',
          [userId]
        );

        // Alle Fahrer-Räume verlassen
        socket.leave('drivers:bicycle');
        socket.leave('drivers:cargo_bike');

        const userResult = await db.query('SELECT name FROM users WHERE id = $1', [userId]);
        const name = userResult.rows[0]?.name || userId;
        console.log(`Fahrer offline: ${name}`);
      } catch (err) {
        console.error('Fehler bei driver:go_offline:', err);
      }
    });

    // Event: Fahrer sendet Standort-Update
    socket.on('driver:location', async ({ lat, lng }) => {
      try {
        if (role !== 'driver') return;

        // Position in DB aktualisieren
        await db.query(
          `UPDATE drivers
           SET latitude = $1, longitude = $2, last_location_update = NOW()
           WHERE user_id = $3`,
          [lat, lng, userId]
        );

        // Alle aktiven Rides dieses Fahrers finden
        const ridesResult = await db.query(
          `SELECT id FROM rides
           WHERE driver_id = $1 AND status IN ('accepted', 'picked_up')`,
          [userId]
        );

        // Kunden der aktiven Rides benachrichtigen
        for (const ride of ridesResult.rows) {
          io.to(`ride:${ride.id}`).emit('driver:location_update', {
            rideId: ride.id,
            lat,
            lng,
          });
        }
      } catch (err) {
        console.error('Fehler bei driver:location:', err);
      }
    });

    // Event: User abonniert Ride-Updates
    socket.on('ride:subscribe', async ({ rideId }) => {
      try {
        if (!rideId) return;

        // Berechtigung prüfen
        const rideResult = await db.query(
          'SELECT customer_id, driver_id FROM rides WHERE id = $1',
          [rideId]
        );

        if (rideResult.rows.length === 0) return;

        const ride = rideResult.rows[0];
        const hasAccess =
          ride.customer_id === userId ||
          ride.driver_id === userId;

        if (!hasAccess) {
          console.log(`Zugriff verweigert für User ${userId} auf Ride ${rideId}`);
          return;
        }

        socket.join(`ride:${rideId}`);
        console.log(`User ${userId} hat Ride ${rideId} abonniert`);
      } catch (err) {
        console.error('Fehler bei ride:subscribe:', err);
      }
    });

    // Verbindung getrennt
    socket.on('disconnect', () => {
      console.log(`Socket getrennt: User ${userId}`);
    });
  });

  return io;
}

module.exports = { setupSockets, getIO };
