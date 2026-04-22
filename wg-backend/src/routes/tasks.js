const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireAuth, requireWgMember } = require('../middleware/auth');

const router = Router({ mergeParams: true });

// Multer für Task-Fotos
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../../wg-uploads');
if (!fs.existsSync(path.join(UPLOAD_DIR, 'tasks'))) fs.mkdirSync(path.join(UPLOAD_DIR, 'tasks'), { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(UPLOAD_DIR, 'tasks')),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).substring(7)}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Nur Bilder erlaubt'));
  },
});

// GET /api/wg/:wgId/tasks — Alle Tasks
router.get('/', requireAuth, requireWgMember, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT t.*, u.name AS creator_name, u.profile_image_url AS creator_image,
              (SELECT COUNT(*) FROM task_completions tc WHERE tc.task_id = t.id) AS completion_count,
              (SELECT json_agg(json_build_object('id', tc2.id, 'user_id', tc2.user_id, 'user_name', u2.name, 'user_image', u2.profile_image_url, 'completed_at', tc2.completed_at) ORDER BY tc2.completed_at DESC)
               FROM task_completions tc2 JOIN users u2 ON u2.id = tc2.user_id WHERE tc2.task_id = t.id) AS completions
       FROM tasks t
       JOIN users u ON u.id = t.created_by
       WHERE t.wg_id = $1
       ORDER BY t.created_at DESC`,
      [req.params.wgId]
    );
    res.json({ tasks: result.rows });
  } catch (err) {
    console.error('Fehler bei GET /tasks:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// POST /api/wg/:wgId/tasks — Task erstellen
router.post('/', requireAuth, requireWgMember, upload.single('photo'), async (req, res) => {
  try {
    const { name, category, description, points } = req.body;
    if (!name) return res.status(400).json({ error: 'Name erforderlich' });

    const photo_url = req.file ? `/uploads/tasks/${req.file.filename}` : null;
    const taskPoints = Math.max(1, parseInt(points) || 1);

    const result = await db.query(
      `INSERT INTO tasks (wg_id, name, category, description, photo_url, points, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.params.wgId, name, category || null, description || null, photo_url, taskPoints, req.user.userId]
    );

    const task = result.rows[0];

    // Creator-Info anhängen
    const userResult = await db.query('SELECT name, profile_image_url FROM users WHERE id = $1', [req.user.userId]);
    task.creator_name = userResult.rows[0]?.name;
    task.creator_image = userResult.rows[0]?.profile_image_url;
    task.completions = null;
    task.completion_count = '0';

    // Socket: alle WG-Mitglieder benachrichtigen
    try {
      const { getIO } = require('../sockets');
      getIO().to(`wg:${req.params.wgId}`).emit('task:created', { task });
    } catch { /* Socket optional */ }

    res.status(201).json({ task });
  } catch (err) {
    console.error('Fehler bei POST /tasks:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// POST /api/wg/:wgId/tasks/:taskId/complete — Task erledigen
router.post('/:taskId/complete', requireAuth, requireWgMember, async (req, res) => {
  try {
    const { taskId } = req.params;

    // Task existiert und gehört zur WG?
    const taskResult = await db.query('SELECT * FROM tasks WHERE id = $1 AND wg_id = $2', [taskId, req.params.wgId]);
    if (taskResult.rows.length === 0) return res.status(404).json({ error: 'Task nicht gefunden' });

    const completionResult = await db.query(
      'INSERT INTO task_completions (task_id, user_id) VALUES ($1, $2) RETURNING *',
      [taskId, req.user.userId]
    );

    const userResult = await db.query('SELECT name, profile_image_url FROM users WHERE id = $1', [req.user.userId]);

    const completion = {
      ...completionResult.rows[0],
      user_name: userResult.rows[0]?.name,
      user_image: userResult.rows[0]?.profile_image_url,
      task_points: taskResult.rows[0].points,
    };

    // Socket
    try {
      const { getIO } = require('../sockets');
      getIO().to(`wg:${req.params.wgId}`).emit('task:completed', { completion, taskId });
    } catch { /* Socket optional */ }

    res.json({ completion });
  } catch (err) {
    console.error('Fehler bei POST /tasks/complete:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// DELETE /api/wg/:wgId/tasks/:taskId — Task löschen
router.delete('/:taskId', requireAuth, requireWgMember, async (req, res) => {
  try {
    const { taskId } = req.params;
    const result = await db.query(
      'DELETE FROM tasks WHERE id = $1 AND wg_id = $2 AND created_by = $3 RETURNING id',
      [taskId, req.params.wgId, req.user.userId]
    );
    if (result.rows.length === 0) return res.status(403).json({ error: 'Nur der Ersteller kann den Task löschen' });

    try {
      const { getIO } = require('../sockets');
      getIO().to(`wg:${req.params.wgId}`).emit('task:deleted', { taskId });
    } catch { /* Socket optional */ }

    res.json({ message: 'Task gelöscht' });
  } catch (err) {
    console.error('Fehler bei DELETE /tasks:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

// GET /api/wg/:wgId/ranking — Punkte-Ranking
router.get('/ranking', requireAuth, requireWgMember, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.name, u.profile_image_url,
              COALESCE(SUM(t.points), 0)::integer AS total_points,
              COUNT(tc.id)::integer AS tasks_completed
       FROM wg_members m
       JOIN users u ON u.id = m.user_id
       LEFT JOIN task_completions tc ON tc.user_id = u.id
       LEFT JOIN tasks t ON t.id = tc.task_id AND t.wg_id = $1
       WHERE m.wg_id = $1
       GROUP BY u.id, u.name, u.profile_image_url
       ORDER BY total_points DESC`,
      [req.params.wgId]
    );
    res.json({ ranking: result.rows });
  } catch (err) {
    console.error('Fehler bei GET /ranking:', err);
    res.status(500).json({ error: 'Interner Serverfehler' });
  }
});

module.exports = router;
