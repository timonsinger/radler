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
      last_location_update TIMESTAMP,
      max_pickup_radius_km DECIMAL(5,1) DEFAULT 10.0,
      max_ride_distance_km DECIMAL(5,1) DEFAULT 20.0
    )
  `);
  // Neue Spalten falls Tabelle schon existiert
  await db.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS max_pickup_radius_km DECIMAL(5,1) DEFAULT 10.0`);
  await db.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS max_ride_distance_km DECIMAL(5,1) DEFAULT 20.0`);
  // Vehicle-Type-Constraint erweitern um Rikscha-Typen
  await db.query(`ALTER TABLE drivers DROP CONSTRAINT IF EXISTS drivers_vehicle_type_check`);
  await db.query(`ALTER TABLE drivers ADD CONSTRAINT drivers_vehicle_type_check CHECK (vehicle_type IN ('bicycle', 'cargo_bike', 'rikscha', 'rikscha_xl', 'tandem'))`);
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
      completed_at     TIMESTAMP,
      delivery_photo_url TEXT
    )
  `);
  // Neue Spalte falls Tabelle schon existiert
  await db.query(`ALTER TABLE rides ADD COLUMN IF NOT EXISTS delivery_photo_url TEXT`);
  // Vehicle-Type-Constraint erweitern um Rikscha-Typen
  await db.query(`ALTER TABLE rides DROP CONSTRAINT IF EXISTS rides_vehicle_type_check`);
  await db.query(`ALTER TABLE rides ADD CONSTRAINT rides_vehicle_type_check CHECK (vehicle_type IN ('bicycle', 'cargo_bike', 'rikscha', 'rikscha_xl', 'tandem'))`);
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

  // Neue Spalten für Abhol-/Übergabe-Codes und Foto-Nachweis
  await db.query(`ALTER TABLE rides ADD COLUMN IF NOT EXISTS pickup_method VARCHAR(10) DEFAULT 'code'`);
  await db.query(`ALTER TABLE rides ADD COLUMN IF NOT EXISTS pickup_code VARCHAR(4)`);
  await db.query(`ALTER TABLE rides ADD COLUMN IF NOT EXISTS pickup_code_confirmed BOOLEAN DEFAULT false`);
  await db.query(`ALTER TABLE rides ADD COLUMN IF NOT EXISTS pickup_photo_url TEXT`);
  await db.query(`ALTER TABLE rides ADD COLUMN IF NOT EXISTS delivery_method VARCHAR(10) DEFAULT 'code'`);
  await db.query(`ALTER TABLE rides ADD COLUMN IF NOT EXISTS delivery_code VARCHAR(4)`);
  await db.query(`ALTER TABLE rides ADD COLUMN IF NOT EXISTS delivery_code_confirmed BOOLEAN DEFAULT false`);
  console.log('✅ Spalten für pickup/delivery method/code/photo erstellt/geprüft');

  // Neue Spalten für Profil-Feature
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url TEXT`);
  console.log('✅ Spalte users.profile_image_url erstellt/geprüft');

  await db.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS description TEXT`);
  await db.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS availability VARCHAR(100)`);
  console.log('✅ Spalten drivers.description, drivers.availability erstellt/geprüft');

  // Bewertungssystem erweitern
  await db.query(`ALTER TABLE rides ADD COLUMN IF NOT EXISTS rating INTEGER`);
  await db.query(`ALTER TABLE rides ADD COLUMN IF NOT EXISTS rating_comment TEXT`);
  await db.query(`ALTER TABLE rides ADD COLUMN IF NOT EXISTS rated_at TIMESTAMP`);
  console.log('✅ Spalten rides.rating, rides.rating_comment, rides.rated_at erstellt/geprüft');

  // Status 'expired' hinzufügen
  await db.query(`ALTER TABLE rides DROP CONSTRAINT IF EXISTS rides_status_check`);
  await db.query(`ALTER TABLE rides ADD CONSTRAINT rides_status_check CHECK (status IN ('pending', 'accepted', 'picked_up', 'delivered', 'cancelled', 'expired'))`);
  console.log('✅ Status-Constraint mit expired aktualisiert');

  // Provision und Fahrer-Verdienst
  await db.query(`ALTER TABLE rides ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(6,2)`);
  await db.query(`ALTER TABLE rides ADD COLUMN IF NOT EXISTS driver_payout DECIMAL(6,2)`);
  console.log('✅ Spalten rides.platform_fee, rides.driver_payout erstellt/geprüft');

  // Fahrer-Onboarding
  await db.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false`);
  console.log('✅ Spalte drivers.onboarding_completed erstellt/geprüft');

  // Admin-Rolle hinzufügen
  await db.query(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
  await db.query(`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('customer', 'driver', 'admin'))`);
  console.log('✅ Rolle admin hinzugefügt');

  // Fahrer-Freischaltung
  await db.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false`);
  await db.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP`);
  await db.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id)`);
  console.log('✅ Spalten drivers.is_approved, approved_at, approved_by erstellt/geprüft');

  // User-Sperrung
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false`);
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT`);
  console.log('✅ Spalten users.is_banned, ban_reason erstellt/geprüft');

  // Settings-Tabelle
  await db.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key VARCHAR(100) PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  // Default-Werte einfügen falls noch nicht vorhanden
  const defaults = [
    ['bicycle_base_fee', '4.00'],
    ['bicycle_per_km', '1.50'],
    ['bicycle_min_price', '5.50'],
    ['cargo_base_fee', '6.00'],
    ['cargo_per_km', '2.00'],
    ['cargo_min_price', '8.00'],
    ['platform_commission', '0.15'],
    ['ride_timeout_minutes', '10'],
    ['rikscha_taxi_base_fee', '5.00'],
    ['rikscha_taxi_per_km', '4.00'],
    ['rikscha_taxi_min_price', '13.00'],
    ['rikscha_xl_taxi_base_fee', '8.00'],
    ['rikscha_xl_taxi_per_km', '5.00'],
    ['rikscha_xl_taxi_min_price', '18.00'],
    ['tandem_taxi_base_fee', '4.00'],
    ['tandem_taxi_per_km', '3.00'],
    ['tandem_taxi_min_price', '10.00'],
    ['rikscha_tour_per_hour', '40.00'],
    ['rikscha_xl_tour_per_hour', '60.00'],
    ['tandem_tour_per_hour', '30.00'],
  ];
  for (const [key, value] of defaults) {
    await db.query(`INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, [key, value]);
  }
  console.log('✅ Settings-Tabelle erstellt/geprüft');

  // Fahrer last_online Spalte
  await db.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS last_online TIMESTAMP`);
  console.log('✅ Spalte drivers.last_online erstellt/geprüft');

  // Geplante Lieferungen
  await db.query(`ALTER TABLE rides ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP`);
  await db.query(`ALTER TABLE rides ADD COLUMN IF NOT EXISTS is_scheduled BOOLEAN DEFAULT false`);
  // Status-Constraint mit 'scheduled' erweitern
  await db.query(`ALTER TABLE rides DROP CONSTRAINT IF EXISTS rides_status_check`);
  await db.query(`ALTER TABLE rides ADD CONSTRAINT rides_status_check CHECK (status IN ('pending', 'accepted', 'picked_up', 'delivered', 'cancelled', 'expired', 'scheduled'))`);
  console.log('✅ Spalten rides.scheduled_at, rides.is_scheduled + Status scheduled erstellt/geprüft');

  // Rikscha-Service: neue Spalten für Personenbeförderung
  await db.query(`ALTER TABLE rides ADD COLUMN IF NOT EXISTS service_type VARCHAR(20) DEFAULT 'courier'`);
  await db.query(`ALTER TABLE rides DROP CONSTRAINT IF EXISTS rides_service_type_check`);
  await db.query(`ALTER TABLE rides ADD CONSTRAINT rides_service_type_check CHECK (service_type IN ('courier', 'rikscha_taxi', 'rikscha_tour'))`);
  await db.query(`ALTER TABLE rides ADD COLUMN IF NOT EXISTS passenger_count INTEGER DEFAULT 1`);
  await db.query(`ALTER TABLE rides ADD COLUMN IF NOT EXISTS tour_duration_hours DECIMAL(3,1)`);
  await db.query(`ALTER TABLE rides ADD COLUMN IF NOT EXISTS tour_start_time TIMESTAMP`);
  await db.query(`ALTER TABLE rides ADD COLUMN IF NOT EXISTS tour_note TEXT`);
  console.log('✅ Rikscha-Spalten (service_type, passenger_count, tour_duration_hours, tour_start_time, tour_note) erstellt/geprüft');

  // Fahrer: accepted_services (courier, rikscha, both)
  await db.query(`ALTER TABLE drivers ADD COLUMN IF NOT EXISTS accepted_services VARCHAR(20) DEFAULT 'courier'`);
  await db.query(`ALTER TABLE drivers DROP CONSTRAINT IF EXISTS drivers_accepted_services_check`);
  await db.query(`ALTER TABLE drivers ADD CONSTRAINT drivers_accepted_services_check CHECK (accepted_services IN ('courier', 'rikscha', 'both'))`);
  // Fahrrad/Lastenrad-Fahrer sollten nur Kurier haben
  await db.query(`UPDATE drivers SET accepted_services = 'courier' WHERE vehicle_type IN ('bicycle', 'cargo_bike') AND accepted_services != 'courier'`);
  console.log('✅ Spalte drivers.accepted_services erstellt/geprüft');

  // Auftragsbeschreibung
  await db.query(`ALTER TABLE rides ADD COLUMN IF NOT EXISTS description TEXT`);
  console.log('✅ Spalte rides.description erstellt/geprüft');

  // Chat-Nachrichten
  await db.query(`
    CREATE TABLE IF NOT EXISTS ride_messages (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      ride_id      UUID REFERENCES rides(id) NOT NULL,
      sender_id    UUID REFERENCES users(id) NOT NULL,
      message      TEXT NOT NULL,
      created_at   TIMESTAMP DEFAULT NOW(),
      is_read      BOOLEAN DEFAULT false
    )
  `);
  console.log('✅ Tabelle ride_messages erstellt/geprüft');

  console.log('✅ Alle Tabellen erstellt!');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('❌ Migration fehlgeschlagen:', err);
  process.exit(1);
});
