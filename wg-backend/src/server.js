require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');

const path = require('path');
const { setupSockets } = require('./sockets');
const db = require('./db');
const pingRoutes = require('./routes/ping');
const authRoutes = require('./routes/auth');
const wgRoutes = require('./routes/wg');
const taskRoutes = require('./routes/tasks');
const shoppingRoutes = require('./routes/shopping');

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

// Statische Uploads (Profilbilder, Task-Fotos)
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../wg-uploads');
app.use('/uploads', express.static(UPLOAD_DIR));

// API Routes
app.use('/api/ping', pingRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/wg', wgRoutes);
app.use('/api/wg/:wgId/tasks', taskRoutes);
app.use('/api/wg/:wgId/shopping', shoppingRoutes);

// DB Migration beim Start
db.query('SELECT 1').then(() => {
  console.log('✅ Datenbank verbunden');
  require('./migrate').runMigrations().then(() => console.log('✅ Migrationen abgeschlossen'));
}).catch(err => console.error('❌ DB-Verbindung fehlgeschlagen:', err.message));

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
