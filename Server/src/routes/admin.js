const express = require('express');
const db = require('../db');
const authMiddleware = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const { getIO } = require('../sockets/index');

const router = express.Router();
router.use(authMiddleware);
router.use(requireAdmin);

// GET /api/admin/dashboard — Dashboard-Statistiken
router.get('/dashboard', async (req, res) => {
  try {
    const todayQ = await db.query(`
      SELECT
        COUNT(*) AS rides,
        COALESCE(SUM(price), 0) AS revenue,
        COALESCE(SUM(platform_fee), 0) AS platform_fees,
        (SELECT COUNT(*) FROM users WHERE created_at::date = CURRENT_DATE AND role = 'customer') AS new_users,
        (SELECT COUNT(*) FROM users WHERE created_at::date = CURRENT_DATE AND role = 'driver') AS new_drivers
      FROM rides WHERE created_at::date = CURRENT_DATE
    `);

    const weekQ = await db.query(`
      SELECT
        COUNT(*) AS rides,
        COALESCE(SUM(price), 0) AS revenue,
        COALESCE(SUM(platform_fee), 0) AS platform_fees,
        (SELECT COUNT(*) FROM users WHERE created_at >= date_trunc('week', CURRENT_DATE) AND role = 'customer') AS new_users,
        (SELECT COUNT(*) FROM users WHERE created_at >= date_trunc('week', CURRENT_DATE) AND role = 'driver') AS new_drivers
      FROM rides WHERE created_at >= date_trunc('week', CURRENT_DATE)
    `);

    const monthQ = await db.query(`
      SELECT
        COUNT(*) AS rides,
        COALESCE(SUM(price), 0) AS revenue,
        COALESCE(SUM(platform_fee), 0) AS platform_fees,
        (SELECT COUNT(*) FROM users WHERE created_at >= date_trunc('month', CURRENT_DATE) AND role = 'customer') AS new_users,
        (SELECT COUNT(*) FROM users WHERE created_at >= date_trunc('month', CURRENT_DATE) AND role = 'driver') AS new_drivers
      FROM rides WHERE created_at >= date_trunc('month', CURRENT_DATE)
    `);

    const totalQ = await db.query(`
      SELECT
        COUNT(*) AS rides,
        COALESCE(SUM(price), 0) AS revenue,
        COALESCE(SUM(platform_fee), 0) AS platform_fees,
        (SELECT COUNT(*) FROM users WHERE role = 'customer') AS users,
        (SELECT COUNT(*) FROM users WHERE role = 'driver') AS drivers,
        (SELECT COUNT(*) FROM drivers WHERE is_online = true) AS active_drivers,
        (SELECT AVG(rating)::DECIMAL(3,2) FROM drivers WHERE rating IS NOT NULL) AS avg_rating
      FROM rides
    `);

    const pendingQ = await db.query(
      "SELECT COUNT(*) AS count FROM drivers WHERE is_approved = false"
    );

    const format = (row) => ({
      rides: parseInt(row.rides, 10),
      revenue: parseFloat(row.revenue),
      platformFees: parseFloat(row.platform_fees),
      newUsers: parseInt(row.new_users, 10),
      newDrivers: parseInt(row.new_drivers, 10),
    });

    const total = totalQ.rows[0];
    res.json({
      stats: {
        today: format(todayQ.rows[0]),
        thisWeek: format(weekQ.rows[0]),
        thisMonth: format(monthQ.rows[0]),
        total: {
          rides: parseInt(total.rides, 10),
          revenue: parseFloat(total.revenue),
          platformFees: parseFloat(total.platform_fees),
          users: parseInt(total.users, 10),
          drivers: parseInt(total.drivers, 10),
          activeDrivers: parseInt(total.active_drivers, 10),
          avgRating: total.avg_rating ? parseFloat(total.avg_rating) : null,
        },
      },
      pendingDriverApprovals: parseInt(pendingQ.rows[0].count, 10),
      scheduledRides: await db.query("SELECT COUNT(*) AS count FROM rides WHERE status = 'scheduled' AND is_scheduled = true AND scheduled_at > NOW()").then(r => parseInt(r.rows[0].count, 10)).catch(() => 0),
    });
  } catch (err) {
    console.error('Fehler bei GET /admin/dashboard:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// GET /api/admin/rides — Alle Aufträge mit Filter
router.get('/rides', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const { status, from, to, driver, customer } = req.query;

    let where = [];
    let params = [];

    if (status && status !== 'all') {
      params.push(status);
      where.push(`r.status = $${params.length}`);
    }
    if (from) {
      params.push(from);
      where.push(`r.created_at >= $${params.length}::date`);
    }
    if (to) {
      params.push(to);
      where.push(`r.created_at < ($${params.length}::date + INTERVAL '1 day')`);
    }
    if (driver) {
      params.push(`%${driver}%`);
      where.push(`(d_user.name ILIKE $${params.length} OR d_user.email ILIKE $${params.length})`);
    }
    if (customer) {
      params.push(`%${customer}%`);
      where.push(`(c_user.name ILIKE $${params.length} OR c_user.email ILIKE $${params.length})`);
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const countQ = await db.query(
      `SELECT COUNT(*) AS total, COALESCE(SUM(r.price), 0) AS revenue, COALESCE(SUM(r.platform_fee), 0) AS platform_fees
       FROM rides r
       LEFT JOIN users c_user ON c_user.id = r.customer_id
       LEFT JOIN users d_user ON d_user.id = r.driver_id
       ${whereClause}`,
      params
    );

    const dataQ = await db.query(
      `SELECT r.id, r.created_at, r.status, r.pickup_address, r.dropoff_address,
              r.distance_km, r.price, r.platform_fee, r.driver_payout, r.vehicle_type,
              r.rating, r.delivery_photo_url, r.pickup_photo_url,
              r.accepted_at, r.completed_at,
              r.pickup_method, r.pickup_code, r.pickup_code_confirmed,
              r.delivery_method, r.delivery_code, r.delivery_code_confirmed,
              r.scheduled_at, r.is_scheduled,
              r.description,
              r.service_type, r.passenger_count, r.tour_duration_hours, r.tour_start_time,
              c_user.name AS customer_name, c_user.email AS customer_email,
              d_user.name AS driver_name, d_user.email AS driver_email
       FROM rides r
       LEFT JOIN users c_user ON c_user.id = r.customer_id
       LEFT JOIN users d_user ON d_user.id = r.driver_id
       ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const total = parseInt(countQ.rows[0].total, 10);
    res.json({
      rides: dataQ.rows,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      filteredRevenue: parseFloat(countQ.rows[0].revenue),
      filteredPlatformFees: parseFloat(countQ.rows[0].platform_fees),
    });
  } catch (err) {
    console.error('Fehler bei GET /admin/rides:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// GET /api/admin/users — Alle Nutzer
router.get('/users', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const { role, search } = req.query;

    let where = [];
    let params = [];

    if (role && role !== 'all') {
      params.push(role);
      where.push(`u.role = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      where.push(`(u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const countQ = await db.query(
      `SELECT COUNT(*) AS total FROM users u ${whereClause}`,
      params
    );

    const dataQ = await db.query(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at, u.is_banned,
              (SELECT COUNT(*) FROM rides WHERE customer_id = u.id OR driver_id = u.id) AS rides_count
       FROM users u
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({
      users: dataQ.rows,
      total: parseInt(countQ.rows[0].total, 10),
    });
  } catch (err) {
    console.error('Fehler bei GET /admin/users:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// GET /api/admin/drivers — Alle Fahrer
router.get('/drivers', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const { status, approved } = req.query;

    let where = [];
    let params = [];

    if (status === 'online') {
      where.push('d.is_online = true');
    } else if (status === 'offline') {
      where.push('d.is_online = false');
    }
    if (approved === 'true') {
      where.push('d.is_approved = true');
    } else if (approved === 'false') {
      where.push('d.is_approved = false');
    }

    const whereClause = where.length > 0 ? 'AND ' + where.join(' AND ') : '';

    const countQ = await db.query(
      `SELECT COUNT(*) AS total FROM drivers d JOIN users u ON u.id = d.user_id WHERE 1=1 ${whereClause}`,
      params
    );

    const pendingQ = await db.query(
      "SELECT COUNT(*) AS count FROM drivers WHERE is_approved = false"
    );

    const dataQ = await db.query(
      `SELECT d.id, d.user_id, u.name, u.email, u.phone, d.vehicle_type,
              d.is_online, d.is_approved, d.onboarding_completed, d.rating,
              d.last_online, u.created_at,
              (SELECT COUNT(*) FROM rides WHERE driver_id = d.user_id AND status = 'delivered') AS total_rides,
              (SELECT COALESCE(SUM(COALESCE(driver_payout, price * 0.85)), 0) FROM rides WHERE driver_id = d.user_id AND status = 'delivered') AS total_earnings
       FROM drivers d
       JOIN users u ON u.id = d.user_id
       WHERE 1=1 ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({
      drivers: dataQ.rows,
      total: parseInt(countQ.rows[0].total, 10),
      pendingApprovals: parseInt(pendingQ.rows[0].count, 10),
    });
  } catch (err) {
    console.error('Fehler bei GET /admin/drivers:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// GET /api/admin/drivers/pending — Fahrer die auf Freischaltung warten
router.get('/drivers/pending', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT d.id, d.user_id, u.name, u.email, u.phone, d.vehicle_type,
              d.onboarding_completed, u.created_at
       FROM drivers d
       JOIN users u ON u.id = d.user_id
       WHERE d.is_approved = false
       ORDER BY d.onboarding_completed DESC, u.created_at ASC`
    );
    res.json({ drivers: result.rows });
  } catch (err) {
    console.error('Fehler bei GET /admin/drivers/pending:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// PATCH /api/admin/drivers/:userId/approve — Fahrer freischalten
router.patch('/drivers/:userId/approve', async (req, res) => {
  try {
    const { userId } = req.params;
    await db.query(
      'UPDATE drivers SET is_approved = true, approved_at = NOW(), approved_by = $1 WHERE user_id = $2',
      [req.user.userId, userId]
    );

    try {
      const io = getIO();
      io.to(`user:${userId}`).emit('driver:approved', {
        message: 'Dein Account wurde freigeschaltet!',
      });
    } catch (socketErr) {
      console.error('Socket.io Fehler bei driver:approved:', socketErr.message);
    }

    console.log(`Fahrer ${userId} freigeschaltet von Admin ${req.user.userId}`);
    res.json({ approved: true });
  } catch (err) {
    console.error('Fehler bei PATCH /admin/drivers/:userId/approve:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// PATCH /api/admin/drivers/:userId/reject — Fahrer ablehnen
router.patch('/drivers/:userId/reject', async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    await db.query(
      'UPDATE drivers SET is_approved = false WHERE user_id = $1',
      [userId]
    );

    try {
      const io = getIO();
      io.to(`user:${userId}`).emit('driver:rejected', {
        reason: reason || 'Kein Grund angegeben',
      });
    } catch (socketErr) {
      console.error('Socket.io Fehler bei driver:rejected:', socketErr.message);
    }

    console.log(`Fahrer ${userId} abgelehnt von Admin ${req.user.userId}. Grund: ${reason}`);
    res.json({ rejected: true });
  } catch (err) {
    console.error('Fehler bei PATCH /admin/drivers/:userId/reject:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// PATCH /api/admin/drivers/:userId/force-offline — Fahrer offline schalten
router.patch('/drivers/:userId/force-offline', async (req, res) => {
  try {
    const { userId } = req.params;
    await db.query('UPDATE drivers SET is_online = false WHERE user_id = $1', [userId]);

    try {
      const io = getIO();
      io.to(`user:${userId}`).emit('driver:forced_offline', {
        reason: 'Du wurdest vom Admin offline geschaltet',
      });
    } catch (socketErr) {
      console.error('Socket.io Fehler bei driver:forced_offline:', socketErr.message);
    }

    console.log(`Fahrer ${userId} offline geschaltet von Admin ${req.user.userId}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Fehler bei PATCH /admin/drivers/:userId/force-offline:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// PATCH /api/admin/users/:id/ban — Nutzer sperren/entsperren
router.patch('/users/:id/ban', async (req, res) => {
  try {
    const { id } = req.params;
    const { banned, reason } = req.body;

    await db.query(
      'UPDATE users SET is_banned = $1, ban_reason = $2 WHERE id = $3',
      [!!banned, reason || null, id]
    );

    // Falls Fahrer gesperrt wird: offline setzen
    if (banned) {
      await db.query('UPDATE drivers SET is_online = false WHERE user_id = $1', [id]);
    }

    console.log(`User ${id} ${banned ? 'gesperrt' : 'entsperrt'} von Admin ${req.user.userId}`);
    res.json({ banned: !!banned });
  } catch (err) {
    console.error('Fehler bei PATCH /admin/users/:id/ban:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// GET /api/admin/stats/daily — Tagesbezogene Statistiken
router.get('/stats/daily', async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days) || 30));

    const result = await db.query(`
      SELECT
        d::date AS date,
        (SELECT COUNT(*) FROM rides WHERE created_at::date = d::date) AS rides,
        (SELECT COALESCE(SUM(price), 0) FROM rides WHERE created_at::date = d::date) AS revenue,
        (SELECT COALESCE(SUM(platform_fee), 0) FROM rides WHERE created_at::date = d::date) AS platform_fees,
        (SELECT COUNT(*) FROM users WHERE created_at::date = d::date AND role = 'customer') AS new_users,
        (SELECT COUNT(*) FROM users WHERE created_at::date = d::date AND role = 'driver') AS new_drivers
      FROM generate_series(CURRENT_DATE - $1 * INTERVAL '1 day', CURRENT_DATE, '1 day') AS d
      ORDER BY d ASC
    `, [days]);

    res.json({
      stats: result.rows.map((r) => ({
        date: r.date,
        rides: parseInt(r.rides, 10),
        revenue: parseFloat(r.revenue),
        platformFees: parseFloat(r.platform_fees),
        newUsers: parseInt(r.new_users, 10),
        newDrivers: parseInt(r.new_drivers, 10),
      })),
    });
  } catch (err) {
    console.error('Fehler bei GET /admin/stats/daily:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// GET /api/admin/stats/hourly — Stündliche Statistiken für einen Tag
router.get('/stats/hourly', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);

    const result = await db.query(`
      SELECT
        h AS hour,
        (SELECT COUNT(*) FROM rides WHERE created_at::date = $1::date AND EXTRACT(HOUR FROM created_at) = h) AS rides,
        (SELECT COALESCE(SUM(price), 0) FROM rides WHERE created_at::date = $1::date AND EXTRACT(HOUR FROM created_at) = h) AS revenue
      FROM generate_series(0, 23) AS h
      ORDER BY h ASC
    `, [date]);

    res.json({
      stats: result.rows.map((r) => ({
        hour: parseInt(r.hour, 10),
        rides: parseInt(r.rides, 10),
        revenue: parseFloat(r.revenue),
      })),
    });
  } catch (err) {
    console.error('Fehler bei GET /admin/stats/hourly:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// GET /api/admin/settings — Settings laden
router.get('/settings', async (req, res) => {
  try {
    const result = await db.query('SELECT key, value FROM settings');
    const settings = {};
    for (const row of result.rows) {
      settings[row.key] = row.value;
    }
    res.json({ settings });
  } catch (err) {
    console.error('Fehler bei GET /admin/settings:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// PATCH /api/admin/settings — Settings speichern
router.patch('/settings', async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings-Objekt erforderlich' });
    }

    const allowed = [
      'bicycle_base_fee', 'bicycle_per_km', 'bicycle_min_price',
      'cargo_base_fee', 'cargo_per_km', 'cargo_min_price',
      'platform_commission', 'ride_timeout_minutes',
      'rikscha_taxi_base_fee', 'rikscha_taxi_per_km', 'rikscha_taxi_min_price',
      'rikscha_xl_taxi_base_fee', 'rikscha_xl_taxi_per_km', 'rikscha_xl_taxi_min_price',
      'tandem_taxi_base_fee', 'tandem_taxi_per_km', 'tandem_taxi_min_price',
      'rikscha_tour_per_hour', 'rikscha_xl_tour_per_hour', 'tandem_tour_per_hour',
    ];

    for (const [key, value] of Object.entries(settings)) {
      if (!allowed.includes(key)) continue;
      await db.query(
        'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
        [key, String(value)]
      );
    }

    console.log(`Settings aktualisiert von Admin ${req.user.userId}`);
    res.json({ updated: true });
  } catch (err) {
    console.error('Fehler bei PATCH /admin/settings:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// GET /api/admin/export/rides — CSV Export
router.get('/export/rides', async (req, res) => {
  try {
    const { from, to } = req.query;
    let where = [];
    let params = [];

    if (from) {
      params.push(from);
      where.push(`r.created_at >= $${params.length}::date`);
    }
    if (to) {
      params.push(to);
      where.push(`r.created_at < ($${params.length}::date + INTERVAL '1 day')`);
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const result = await db.query(
      `SELECT r.id, r.created_at, r.status, r.pickup_address, r.dropoff_address,
              r.distance_km, r.price, r.platform_fee, r.driver_payout, r.vehicle_type,
              r.rating, r.accepted_at, r.completed_at,
              c.name AS customer_name, c.email AS customer_email,
              d.name AS driver_name, d.email AS driver_email
       FROM rides r
       LEFT JOIN users c ON c.id = r.customer_id
       LEFT JOIN users d ON d.id = r.driver_id
       ${whereClause}
       ORDER BY r.created_at DESC`,
      params
    );

    const headers = ['ID', 'Erstellt', 'Status', 'Abholung', 'Ziel', 'Distanz (km)', 'Preis', 'Provision', 'Fahrer-Verdienst', 'Fahrzeug', 'Bewertung', 'Angenommen', 'Abgeschlossen', 'Kunde', 'Kunde Email', 'Fahrer', 'Fahrer Email'];
    const escape = (v) => {
      if (v == null) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    let csv = headers.join(',') + '\n';
    for (const r of result.rows) {
      csv += [
        r.id, r.created_at, r.status, r.pickup_address, r.dropoff_address,
        r.distance_km, r.price, r.platform_fee, r.driver_payout, r.vehicle_type,
        r.rating, r.accepted_at, r.completed_at,
        r.customer_name, r.customer_email, r.driver_name, r.driver_email,
      ].map(escape).join(',') + '\n';
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="radler-auftraege-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send('\uFEFF' + csv); // BOM for Excel
  } catch (err) {
    console.error('Fehler bei GET /admin/export/rides:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

module.exports = router;
