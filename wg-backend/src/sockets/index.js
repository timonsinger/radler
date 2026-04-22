const { Server } = require('socket.io');

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

  io.on('connection', (socket) => {
    console.log(`Socket verbunden: ${socket.id}`);

    socket.on('disconnect', () => {
      console.log(`Socket getrennt: ${socket.id}`);
    });
  });

  return io;
}

module.exports = { setupSockets, getIO };
