# DSA-Heldenbogen

React-Frontend mit zentraler Node.js-API und SQLite-Datenbank. Jeder Benutzer kann mehrere Helden anlegen, öffnen und bearbeiten. Anmeldung und Heldendaten werden auf dem Server gespeichert.

Der Heldenbogen besitzt einen geschützten Spielmodus für laufende Ressourcen und einen Setup-Modus für Grunddaten, Eigenschaften, Talente, Zauber, Maximalwerte und Inventar. Helden können im Archiv nach einer Bestätigung wieder gelöscht werden.

## Voraussetzungen

- Node.js 24
- npm
- Nginx für den Produktivbetrieb

## Lokale Entwicklung

In einem Terminal die API starten:

```bash
npm ci
npm run server
```

In einem zweiten Terminal das Frontend starten:

```bash
npm run dev
```

Vite leitet `/api` während der Entwicklung an `127.0.0.1:3000` weiter. Die SQLite-Datei wird unter `data/dsa.db` erstellt und nicht in Git aufgenommen.

## Installation auf dem Raspberry Pi

```bash
cd ~/apps/DSA
npm ci
npm run lint
npm run build
sudo mkdir -p /var/www/dsa
sudo rsync -a --delete dist/ /var/www/dsa/
```

API als Dienst installieren:

```bash
sudo cp deploy/dsa-api.service /etc/systemd/system/dsa-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now dsa-api
sudo systemctl status dsa-api
```

Nginx-Konfiguration installieren:

```bash
sudo cp deploy/nginx-dsa.conf /etc/nginx/sites-available/dsa
sudo ln -sfn /etc/nginx/sites-available/dsa /etc/nginx/sites-enabled/dsa
sudo nginx -t
sudo systemctl reload nginx
```

API testen:

```bash
curl http://127.0.0.1:3000/api/health
```

Erwartete Antwort:

```json
{"ok":true}
```

## Daten und Backups

Die Datenbank liegt auf dem Pi unter:

```text
/home/simon/apps/DSA/data/dsa.db
```

Für ein konsistentes manuelles Backup:

```bash
mkdir -p ~/backups
sqlite3 ~/apps/DSA/data/dsa.db ".backup '$HOME/backups/dsa-$(date +%F).db'"
```

Die Dateien `.env`, `data/` und `*.db` werden bewusst nicht versioniert.

## Sicherheit

- Passwörter werden mit `scrypt` und individuellem Salt gespeichert.
- Sitzungen verwenden zufällige Token in `HttpOnly`- und `SameSite=Strict`-Cookies.
- Die API lauscht nur auf `127.0.0.1`; Zugriffe laufen über Nginx.
- Für einen späteren Internetzugriff muss HTTPS eingerichtet und `COOKIE_SECURE=true` gesetzt werden.
