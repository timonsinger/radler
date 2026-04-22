require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');

const { setupSockets } = require('./sockets');
const pingRoutes = require('./routes/ping');

const app = express();
const PORT = process.env.PORT || 4001;

// CORS Origins aus .env lesen (kommagetrennt)
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3001'];

// Middleware: Sicherheit und Parsing
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json());

// Rate Limiting: 1000 Anfragen pro 15 Minuten
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Anfragen. Bitte warte kurz.' },
});
app.use('/api/', limiter);

// HTTP Server erstellen (benötigt Socket.io)
const server = http.createServer(app);

// Socket.io initialisieren
setupSockets(server);

// API Routes
app.use('/api/ping', pingRoutes);

// Health-Check Route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'wg-backend',
    uptime: Math.floor(process.uptime()),
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route nicht gefunden' });
});

// Globaler Error Handler
app.use((err, req, res, next) => {
  console.error('Unbehandelter Fehler:', err);
  res.status(500).json({ error: 'Interner Serverfehler' });
});

// Server starten
server.listen(PORT, () => {
  console.log(`🧹 WG-Backend läuft auf Port ${PORT}`);
});
