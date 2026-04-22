# WG-Backend

Express-API + Socket.io für die WG-Putzplan-App.

## Lokal starten

```bash
# .env anlegen (aus .env.example kopieren, DB-Passwort setzen)
cp .env.example .env

# Dependencies installieren
npm install

# Datenbank migrieren
npm run migrate

# Starten (Port 4001)
npm run dev
```

## ENV-Variablen

| Variable | Beschreibung | Default |
|----------|-------------|---------|
| `PORT` | Server-Port | `4001` |
| `DATABASE_URL` | PostgreSQL Connection String | – |
| `CORS_ORIGINS` | Erlaubte Origins (kommagetrennt) | `http://localhost:3001` |

## Endpoints

- `GET /api/health` — Healthcheck
- `GET /api/ping` — Test-Ping mit DB-Counter
