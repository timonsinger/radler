require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const http = require('http');
const path = require('path');
const fs = require('fs');

const db = require('./db');
const { setupSockets, getIO } = require('./sockets');
const authRoutes = require('./routes/auth');
const ridesRoutes = require('./routes/rides');
const driversRoutes = require('./routes/drivers');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 4000;

// CORS Origins aus .env lesen (kommagetrennt)
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : ['http://localhost:3000'];

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

// Uploads statisch servieren
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/rides', ridesRoutes);
app.use('/api/drivers', driversRoutes);
app.use('/api/admin', adminRoutes);

// Health-Check Route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// 404 Handler für unbekannte Routen
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
  console.log(`🚲 Radler Backend läuft auf Port ${PORT}`);

  // Automatische Stornierung von abgelaufenen Aufträgen (alle 60 Sekunden)
  setInterval(async () => {
    try {
      // Timeout aus Settings lesen
      let timeoutMinutes = 10;
      try {
        const settingsResult = await db.query("SELECT value FROM settings WHERE key = 'ride_timeout_minutes'");
        if (settingsResult.rows.length > 0) timeoutMinutes = parseInt(settingsResult.rows[0].value) || 10;
      } catch { /* Default verwenden */ }

      const result = await db.query(`
        UPDATE rides
        SET status = 'expired', completed_at = NOW()
        WHERE status = 'pending'
        AND created_at < NOW() - INTERVAL '1 minute' * $1
        RETURNING id, customer_id
      `, [timeoutMinutes]);
      if (result.rows.length > 0) {
        const io = getIO();
        result.rows.forEach((ride) => {
          io.to(`user:${ride.customer_id}`).emit('ride:status_update', {
            rideId: ride.id,
            status: 'expired',
          });
          console.log(`Auftrag ${ride.id} automatisch abgelaufen (kein Fahrer gefunden)`);
        });
      }
    } catch (err) {
      console.error('Fehler bei Auto-Stornierung:', err);
    }

    // Geplante Lieferungen: 30 Min vor scheduled_at → status von 'scheduled' auf 'pending' setzen und Fahrer benachrichtigen
    try {
      const scheduledResult = await db.query(`
        UPDATE rides
        SET status = 'pending'
        WHERE status = 'scheduled'
        AND is_scheduled = true
        AND driver_id IS NULL
        AND scheduled_at <= NOW() + INTERVAL '30 minutes'
        RETURNING *
      `);
      if (scheduledResult.rows.length > 0) {
        const io = getIO();
        for (const ride of scheduledResult.rows) {
          // Passende Fahrer benachrichtigen
          const driversResult = await db.query(
            `SELECT d.user_id, d.latitude, d.longitude, d.max_pickup_radius_km, d.max_ride_distance_km
             FROM drivers d
             WHERE d.is_online = true
               AND d.vehicle_type = $1
               AND d.latitude IS NOT NULL
               AND d.longitude IS NOT NULL`,
            [ride.vehicle_type]
          );

          const pLat = parseFloat(ride.pickup_lat);
          const pLng = parseFloat(ride.pickup_lng);
          const rideDist = parseFloat(ride.distance_km) || 0;

          let notified = 0;
          for (const driver of driversResult.rows) {
            const maxPickup = parseFloat(driver.max_pickup_radius_km) || 10;
            const maxRide = parseFloat(driver.max_ride_distance_km) || 20;
            const R = 6371;
            const dLat = (pLat - parseFloat(driver.latitude)) * Math.PI / 180;
            const dLng = (pLng - parseFloat(driver.longitude)) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(parseFloat(driver.latitude) * Math.PI / 180) * Math.cos(pLat * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
            const pickupDist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

            if (pickupDist <= maxPickup && rideDist <= maxRide) {
              io.to(`user:${driver.user_id}`).emit('ride:new', { ride });
              notified++;
            }
          }
          console.log(`Geplanter Auftrag ${ride.id} aktiviert (scheduled_at: ${ride.scheduled_at}): ${notified} Fahrer benachrichtigt`);
        }
      }
    } catch (err) {
      console.error('Fehler bei Scheduled-Aktivierung:', err);
    }

    // Geplante Lieferungen: 30 Min nach scheduled_at ohne Fahrer → expired
    try {
      const expiredScheduled = await db.query(`
        UPDATE rides
        SET status = 'expired', completed_at = NOW()
        WHERE is_scheduled = true
        AND status IN ('pending', 'scheduled')
        AND driver_id IS NULL
        AND scheduled_at < NOW() - INTERVAL '30 minutes'
        RETURNING id, customer_id
      `);
      if (expiredScheduled.rows.length > 0) {
        const io = getIO();
        expiredScheduled.rows.forEach((ride) => {
          io.to(`user:${ride.customer_id}`).emit('ride:status_update', {
            rideId: ride.id,
            status: 'expired',
          });
          console.log(`Geplanter Auftrag ${ride.id} abgelaufen (kein Fahrer gefunden)`);
        });
      }
    } catch (err) {
      console.error('Fehler bei Scheduled-Expiration:', err);
    }
  }, 60000);
});
