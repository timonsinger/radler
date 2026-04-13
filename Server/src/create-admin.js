// Aufruf: node src/create-admin.js admin@radler-deutschland.de MeinPasswort "Admin Name"
// Erstellt User mit role='admin'

require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('./db');

async function createAdmin() {
  const [,, email, password, name] = process.argv;

  if (!email || !password || !name) {
    console.error('Usage: node src/create-admin.js <email> <password> "<name>"');
    process.exit(1);
  }

  try {
    // Prüfen ob User schon existiert
    const existing = await db.query('SELECT id, role FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      if (existing.rows[0].role === 'admin') {
        console.log(`Admin ${email} existiert bereits.`);
      } else {
        // Rolle zu admin ändern
        await db.query('UPDATE users SET role = $1 WHERE id = $2', ['admin', existing.rows[0].id]);
        console.log(`User ${email} wurde zum Admin befördert.`);
      }
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await db.query(
      `INSERT INTO users (email, password_hash, role, name)
       VALUES ($1, $2, 'admin', $3)
       RETURNING id, email, name, role`,
      [email.toLowerCase(), passwordHash, name]
    );

    console.log('✅ Admin erstellt:', result.rows[0]);
    process.exit(0);
  } catch (err) {
    console.error('❌ Fehler:', err.message);
    process.exit(1);
  }
}

createAdmin();
