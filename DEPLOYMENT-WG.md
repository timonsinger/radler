# WG-App Deployment-Checkliste

## Voraussetzungen
- SSH-Zugang zum Hetzner Server
- DNS A-Record für `wg.radler-deutschland.de` → `178.104.170.247`

---

## 1. DNS-Eintrag anlegen

Beim Domain-Provider von `radler-deutschland.de`:
- **Typ:** A
- **Name:** wg
- **Wert:** 178.104.170.247
- **TTL:** 3600

---

## 2. Code auf Server ziehen

```bash
ssh -i ~/.ssh/rider_key root@178.104.170.247
cd /home/radler
git pull
```

---

## 3. Neue Datenbank anlegen

```bash
sudo -u postgres psql
CREATE DATABASE wg;
GRANT ALL PRIVILEGES ON DATABASE wg TO rider;
\c wg
GRANT ALL ON SCHEMA public TO rider;
\q
```

---

## 4. WG-Backend: Install + Migrate + PM2

```bash
cd /home/radler/wg-backend
npm install

# .env anlegen
cat > .env << 'EOF'
PORT=4001
NODE_ENV=production
DATABASE_URL=postgresql://rider:DEIN_DB_PASSWORT@localhost:5432/wg
CORS_ORIGINS=https://wg.radler-deutschland.de
EOF

# Migration ausführen
npm run migrate

# PM2 starten
pm2 start src/server.js --name wg-backend
pm2 save
```

---

## 5. WG-Frontend: Install + Build + PM2

```bash
cd /home/radler/wg-frontend
npm install

# .env.local anlegen (Production)
cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=https://wg.radler-deutschland.de
NEXT_PUBLIC_SOCKET_URL=https://wg.radler-deutschland.de
EOF

# Build
npm run build

# PM2 starten (Port 3001)
pm2 start "npm start" --name wg-frontend
pm2 save
```

---

## 6. Nginx-Config

Neue Datei anlegen:

```bash
cat > /etc/nginx/sites-available/wg.radler-deutschland.de << 'NGINX'
server {
    listen 80;
    server_name wg.radler-deutschland.de;

    location /api {
        proxy_pass http://localhost:4001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io {
        proxy_pass http://localhost:4001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX

# Aktivieren
ln -s /etc/nginx/sites-available/wg.radler-deutschland.de /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## 7. SSL-Zertifikat

```bash
certbot --nginx -d wg.radler-deutschland.de
```

---

## 8. Verifizieren

- [ ] `https://wg.radler-deutschland.de` lädt die Testseite
- [ ] "Ping Backend" Button → Response mit Timestamp + Counter
- [ ] Counter erhöht sich bei jedem Klick
- [ ] Socket.io Handshake (DevTools → Network → WS → 101)
- [ ] Radler-Apps laufen unverändert (`radler-deutschland.de`, `fahrer.radler-deutschland.de`)
- [ ] PWA installierbar (Browser → "Zum Homebildschirm")
- [ ] SSL gültig (grünes Schloss)

---

## PM2 Übersicht nach Deployment

| Name | Port | Beschreibung |
|------|------|-------------|
| radler-backend | 4000 | Radler Express API |
| radler-frontend | 3000 | Radler Kunden-App |
| radler-driver | 3002 | Radler Fahrer-App |
| radler-admin | 3003 | Radler Admin-Dashboard |
| **wg-backend** | **4001** | WG Express API |
| **wg-frontend** | **3001** | WG Next.js PWA |
