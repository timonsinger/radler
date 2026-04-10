require('dotenv').config();
const db = require('./db');

async function migrate() {
  // Tabelle: users
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email        VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role         VARCHAR(20) NOT NULL CHECK (role IN ('customer', 'driver')),
      name         VARCHAR(100) NOT NULL,
      phone        VARCHAR(20),
      created_at   TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log('✅ Tabelle users erstellt/geprüft');

  // Tabelle: drivers
  await db.query(`
    CREATE TABLE IF NOT EXISTS drivers (
      id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id              UUID REFERENCES users(id) UNIQUE NOT NULL,
      vehicle_type         VARCHAR(20) CHECK (vehicle_type IN ('bicycle', 'cargo_bike')),
      is_online            BOOLEAN DEFAULT false,
      latitude             DECIMAL(10,7),
      longitude            DECIMAL(10,7),
      rating               DECIMAL(3,2) DEFAULT 5.00,
      last_location_update TIMESTAMP
    )
  `);
  console.log('✅ Tabelle drivers erstellt/geprüft');

  // Tabelle: rides
  await db.query(`
    CREATE TABLE IF NOT EXISTS rides (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id      UUID REFERENCES users(id) NOT NULL,
      driver_id        UUID REFERENCES users(id),
      status           VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'picked_up', 'delivered', 'cancelled')),
      vehicle_type     VARCHAR(20) NOT NULL CHECK (vehicle_type IN ('bicycle', 'cargo_bike')),
      pickup_address   TEXT NOT NULL,
      pickup_lat       DECIMAL(10,7) NOT NULL,
      pickup_lng       DECIMAL(10,7) NOT NULL,
      dropoff_address  TEXT NOT NULL,
      dropoff_lat      DECIMAL(10,7) NOT NULL,
      dropoff_lng      DECIMAL(10,7) NOT NULL,
      distance_km      DECIMAL(6,2),
      price            DECIMAL(6,2) NOT NULL,
      invite_email     VARCHAR(255),
      invite_role      VARCHAR(20) CHECK (invite_role IN ('pickup', 'dropoff')),
      created_at       TIMESTAMP DEFAULT NOW(),
      accepted_at      TIMESTAMP,
      completed_at     TIMESTAMP
    )
  `);
  console.log('✅ Tabelle rides erstellt/geprüft');

  // Tabelle: invite_tokens
  await db.query(`
    CREATE TABLE IF NOT EXISTS invite_tokens (
      id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ride_id            UUID REFERENCES rides(id) NOT NULL,
      email              VARCHAR(255) NOT NULL,
      token              VARCHAR(255) UNIQUE NOT NULL,
      role               VARCHAR(20) NOT NULL CHECK (role IN ('pickup', 'dropoff')),
      location_confirmed BOOLEAN DEFAULT false,
      lat                DECIMAL(10,7),
      lng                DECIMAL(10,7),
      created_at         TIMESTAMP DEFAULT NOW(),
      expires_at         TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours')
    )
  `);
  console.log('✅ Tabelle invite_tokens erstellt/geprüft');

  console.log('✅ Alle Tabellen erstellt!');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('❌ Migration fehlgeschlagen:', err);
  process.exit(1);
});
