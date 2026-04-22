const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('../db');

let io;

function getIO() {
  if (!io) throw new Error('Socket.io wurde noch nicht initialisiert');
  return io;
}

function setupSockets(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(o => o.trim()) : '*',
      methods: ['GET', 'POST'],
    },
  });

  // JWT-Authentifizierung bei Verbindung
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Nicht authentifiziert'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'wg-secret-key');
      socket.userId = decoded.userId;
      socket.email = decoded.email;
      next();
    } catch {
      next(new Error('Ungültiger Token'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`Socket verbunden: ${socket.id} (User ${socket.userId})`);

    // Automatisch dem WG-Room beitreten
    try {
      const result = await db.query('SELECT wg_id FROM wg_members WHERE user_id = $1 LIMIT 1', [socket.userId]);
      if (result.rows.length > 0) {
        const wgId = result.rows[0].wg_id;
        socket.join(`wg:${wgId}`);
        console.log(`User ${socket.userId} joined room wg:${wgId}`);
      }
    } catch (err) {
      console.error('Fehler beim WG-Room-Join:', err);
    }

    // Manuell Room wechseln (z.B. nach WG-Beitritt)
    socket.on('join_wg', (wgId) => {
      socket.join(`wg:${wgId}`);
      console.log(`User ${socket.userId} manually joined room wg:${wgId}`);
    });

    socket.on('disconnect', () => {
      console.log(`Socket getrennt: ${socket.id}`);
    });
  });

  return io;
}

module.exports = { setupSockets, getIO };
