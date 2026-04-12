const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { shouldSendToCustomer } = require('../locationThrottle');

let io;

function getIO() {
  if (!io) throw new Error('Socket.io wurde noch nicht initialisiert');
  return io;
}

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

  // Alle 5 Sekunden: Verfügbare Fahrer-Positionen an abonnierte Kunden senden
  setInterval(async () => {
    try {
      for (const vehicleType of ['bicycle', 'cargo_bike']) {
        const room = io.sockets.adapter.rooms.get(`customers:drivers:${vehicleType}`);
        if (!room || room.size === 0) continue;

        const driversResult = await db.query(
          `SELECT d.user_id AS id, d.latitude, d.longitude, d.vehicle_type, d.rating
           FROM drivers d
           WHERE d.is_online = true
             AND d.vehicle_type = $1
             AND d.latitude IS NOT NULL
             AND d.longitude IS NOT NULL`,
          [vehicleType]
        );

        io.to(`customers:drivers:${vehicleType}`).emit('drivers:positions', {
          drivers: driversResult.rows,
        });
      }
    } catch (err) {
      console.error('Fehler bei drivers:positions Interval:', err.message);
    }
  }, 5000);

  io.on('connection', async (socket) => {
    const { userId, role } = socket.user;
    console.log(`Socket verbunden: User ${userId} (${role})`);

    // Jeder User joined seinen persönlichen Raum
    socket.join(`user:${userId}`);

    // Event: Fahrer geht online
    socket.on('driver:go_online', async () => {
      try {
        if (role !== 'driver') return;

        const driverResult = await db.query(
          'SELECT vehicle_type FROM drivers WHERE user_id = $1',
          [userId]
        );
        const driver = driverResult.rows[0];
        const vehicleType = driver?.vehicle_type;

        await db.query(
          'UPDATE drivers SET is_online = true WHERE user_id = $1',
          [userId]
        );

        if (vehicleType) {
          socket.join(`drivers:${vehicleType}`);
        } else {
          socket.join('drivers:bicycle');
          socket.join('drivers:cargo_bike');
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

        await db.query(
          `UPDATE drivers
           SET latitude = $1, longitude = $2, last_location_update = NOW()
           WHERE user_id = $3`,
          [lat, lng, userId]
        );

        const ridesResult = await db.query(
          `SELECT id FROM rides
           WHERE driver_id = $1 AND status IN ('accepted', 'picked_up')`,
          [userId]
        );

        // Nur alle 30 Sekunden an Kunden senden
        for (const ride of ridesResult.rows) {
          if (shouldSendToCustomer(ride.id)) {
            io.to(`ride:${ride.id}`).emit('driver:location_update', {
              rideId: ride.id,
              lat,
              lng,
            });
          }
        }
      } catch (err) {
        console.error('Fehler bei driver:location:', err);
      }
    });

    // Event: User abonniert Ride-Updates
    socket.on('ride:subscribe', async ({ rideId }) => {
      try {
        if (!rideId) return;

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

    // Event: Kunde abonniert Fahrer-Positionen
    socket.on('drivers:subscribe', ({ vehicle_type }) => {
      if (!vehicle_type || !['bicycle', 'cargo_bike'].includes(vehicle_type)) return;
      // Alte Subscription entfernen
      if (socket.driverSubscription) {
        socket.leave(`customers:drivers:${socket.driverSubscription}`);
      }
      socket.driverSubscription = vehicle_type;
      socket.join(`customers:drivers:${vehicle_type}`);
      console.log(`User ${userId} abonniert Fahrer: ${vehicle_type}`);
    });

    // Event: Kunde kündigt Fahrer-Positionen
    socket.on('drivers:unsubscribe', () => {
      if (socket.driverSubscription) {
        socket.leave(`customers:drivers:${socket.driverSubscription}`);
        socket.driverSubscription = null;
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket getrennt: User ${userId}`);
    });
  });

  return io;
}

module.exports = { setupSockets, getIO };
