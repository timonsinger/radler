# Radler Backend

Radler ist eine Kurier-App für Fahrradkuriere und Lastenräder in Konstanz – ähnlich wie Uber, aber für nachhaltige Stadtlogistik.

## Tech-Stack

| Bereich        | Technologie                          |
|----------------|--------------------------------------|
| Runtime        | Node.js                              |
| Framework      | Express                              |
| Datenbank      | PostgreSQL (via `pg`)                |
| Echtzeit       | Socket.io                            |
| Auth           | JWT + bcrypt                         |
| Prozessmanager | PM2 (`ecosystem.config.js`)          |

## Setup

### 1. Voraussetzungen

- [Node.js](https://nodejs.org/) (v18+)
- [PostgreSQL](https://www.postgresql.org/) (v14+)

### 2. PostgreSQL Datenbank erstellen

```sql
CREATE USER radler WITH PASSWORD 'DEIN_PASSWORT';
CREATE DATABASE radler OWNER radler;
```

### 3. Abhängigkeiten installieren

```bash
npm install
```

### 4. `.env` konfigurieren

```bash
cp .env.example .env
```

Dann `.env` bearbeiten und Werte eintragen:

```
PORT=4000
DATABASE_URL=postgresql://radler:DEIN_PASSWORT@localhost:5432/radler
JWT_SECRET=ein-sehr-langes-zufaelliges-geheimnis
CORS_ORIGINS=http://localhost:3000
```

### 5. Datenbank-Migration ausführen

```bash
npm run migrate
```

Erstellt alle Tabellen (`users`, `drivers`, `rides`, `invite_tokens`).

### 6. Server starten

```bash
# Entwicklung (mit Auto-Reload)
npm run dev

# Produktion
npm start

# Mit PM2 (Produktion)
pm2 start ecosystem.config.js
```

---

## API Endpunkte

### Auth

| Methode | Pfad             | Beschreibung              | Auth |
|---------|------------------|---------------------------|------|
| POST    | /api/auth/register | Registrierung            | –    |
| POST    | /api/auth/login    | Anmeldung                | –    |
| GET     | /api/auth/me       | Eigenes Profil laden     | ✅   |

### Rides (Aufträge)

| Methode | Pfad                     | Beschreibung                    | Auth |
|---------|--------------------------|---------------------------------|------|
| POST    | /api/rides               | Neuen Auftrag erstellen         | ✅ Kunde |
| GET     | /api/rides               | Aufträge laden                  | ✅   |
| GET     | /api/rides/:id           | Einzelnen Auftrag laden         | ✅   |
| PATCH   | /api/rides/:id/accept    | Auftrag annehmen                | ✅ Fahrer |
| PATCH   | /api/rides/:id/status    | Status ändern (picked_up/delivered) | ✅ Fahrer |
| PATCH   | /api/rides/:id/cancel    | Auftrag stornieren              | ✅   |

### Drivers (Fahrer)

| Methode | Pfad                  | Beschreibung                      | Auth |
|---------|-----------------------|-----------------------------------|------|
| PATCH   | /api/drivers/status   | Online/Offline setzen             | ✅ Fahrer |
| PATCH   | /api/drivers/location | Standort aktualisieren            | ✅ Fahrer |
| GET     | /api/drivers/stats    | Tages-Statistiken laden           | ✅ Fahrer |

### System

| Methode | Pfad         | Beschreibung   |
|---------|--------------|----------------|
| GET     | /api/health  | Health-Check   |

---

## WebSocket Events

Verbindung herstellen mit JWT-Token:
```javascript
const socket = io('http://localhost:4000', {
  auth: { token: 'DEIN_JWT_TOKEN' }
});
```

### Client → Server

| Event              | Payload              | Beschreibung                   |
|--------------------|----------------------|--------------------------------|
| `driver:go_online`  | –                    | Fahrer geht online             |
| `driver:go_offline` | –                    | Fahrer geht offline            |
| `driver:location`   | `{ lat, lng }`       | Standort senden                |
| `ride:subscribe`    | `{ rideId }`         | Ride-Updates abonnieren        |

### Server → Client

| Event                  | Payload                     | Empfänger          |
|------------------------|-----------------------------|--------------------|
| `ride:new`             | `{ ride }`                  | Online-Fahrer      |
| `ride:accepted`        | `{ ride, driver }`          | Kunde              |
| `ride:removed`         | `{ rideId }`                | Fahrer (anderer)   |
| `ride:status_update`   | `{ rideId, status }`        | Kunde + Fahrer     |
| `driver:location_update` | `{ rideId, lat, lng }`    | Kunde              |
