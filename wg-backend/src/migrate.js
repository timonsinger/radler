require('dotenv').config();
const db = require('./db');

async function migrate() {
  // Users
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email           VARCHAR(255) UNIQUE NOT NULL,
      password_hash   VARCHAR(255) NOT NULL,
      name            VARCHAR(100) NOT NULL,
      profile_image_url TEXT,
      created_at      TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('✅ Tabelle users erstellt/geprüft');

  // WGs
  await db.query(`
    CREATE TABLE IF NOT EXISTS wgs (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name            VARCHAR(100) NOT NULL,
      invite_code     VARCHAR(8) UNIQUE NOT NULL,
      created_by      UUID REFERENCES users(id) NOT NULL,
      created_at      TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('✅ Tabelle wgs erstellt/geprüft');

  // WG Members
  await db.query(`
    CREATE TABLE IF NOT EXISTS wg_members (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wg_id           UUID REFERENCES wgs(id) ON DELETE CASCADE NOT NULL,
      user_id         UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      joined_at       TIMESTAMP DEFAULT NOW(),
      UNIQUE(wg_id, user_id)
    )
  `);
  console.log('✅ Tabelle wg_members erstellt/geprüft');

  // Tasks
  await db.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wg_id           UUID REFERENCES wgs(id) ON DELETE CASCADE NOT NULL,
      name            VARCHAR(200) NOT NULL,
      category        VARCHAR(100),
      description     TEXT,
      photo_url       TEXT,
      points          INTEGER NOT NULL DEFAULT 1,
      created_by      UUID REFERENCES users(id) NOT NULL,
      created_at      TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('✅ Tabelle tasks erstellt/geprüft');

  // Task Completions
  await db.query(`
    CREATE TABLE IF NOT EXISTS task_completions (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id         UUID REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
      user_id         UUID REFERENCES users(id) NOT NULL,
      completed_at    TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('✅ Tabelle task_completions erstellt/geprüft');

  // Shopping Items
  await db.query(`
    CREATE TABLE IF NOT EXISTS shopping_items (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      wg_id           UUID REFERENCES wgs(id) ON DELETE CASCADE NOT NULL,
      name            VARCHAR(200) NOT NULL,
      checked         BOOLEAN DEFAULT false,
      added_by        UUID REFERENCES users(id) NOT NULL,
      checked_by      UUID REFERENCES users(id),
      created_at      TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('✅ Tabelle shopping_items erstellt/geprüft');

  // Test-Tabelle behalten
  await db.query(`
    CREATE TABLE IF NOT EXISTS ping_log (
      id SERIAL PRIMARY KEY,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('✅ Tabelle ping_log erstellt/geprüft');

  // Migration: is_due Spalte für Tasks
  await db.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_due BOOLEAN DEFAULT false`);
  console.log('✅ Migration: is_due Spalte hinzugefügt');

  console.log('✅ Alle Tabellen erstellt!');
}

// Export für Import durch server.js
module.exports = { runMigrations: migrate };

// Direkt ausführen wenn als Script gestartet
if (require.main === module) {
  migrate()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Migration fehlgeschlagen:', err);
      process.exit(1);
    });
}
