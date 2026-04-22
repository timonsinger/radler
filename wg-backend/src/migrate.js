require('dotenv').config();
const db = require('./db');

async function migrate() {
  // Test-Tabelle: ping_log
  await db.query(`
    CREATE TABLE IF NOT EXISTS ping_log (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('✅ Tabelle ping_log erstellt/geprüft');

  console.log('✅ Alle Tabellen erstellt!');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('❌ Migration fehlgeschlagen:', err);
  process.exit(1);
});
