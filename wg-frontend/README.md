# WG-Frontend

Next.js PWA für die WG-Putzplan-App.

## Lokal starten

```bash
# .env.local anlegen
cp .env.example .env.local

# Dependencies installieren
npm install

# Starten (Port 3001)
npm run dev
```

## ENV-Variablen

| Variable | Beschreibung | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend-URL | `http://localhost:4001` |
| `NEXT_PUBLIC_SOCKET_URL` | Socket.io-URL | `http://localhost:4001` |

## Production

```
NEXT_PUBLIC_API_URL=https://wg.radler-deutschland.de
NEXT_PUBLIC_SOCKET_URL=https://wg.radler-deutschland.de
```

## PWA

Die App ist als PWA installierbar (manifest.json + Service Worker).
Icons in `public/icon-192.png` und `public/icon-512.png` müssen noch erstellt werden.
