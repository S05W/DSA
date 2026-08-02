# DSA-Update vom 2. August 2026

Dieses Paket enthält den vollständigen Projektstand, die auf die neue Struktur
umgewandelten Helden und einen abgesicherten Aktualisierungsweg für den
Raspberry Pi. Benutzerkonten, Passwörter, Karten, Handouts, Bilder und PDFs
werden beim Update nicht ersetzt.

## Zuerst privat unter Windows testen

PowerShell im entpackten Ordner `DSA` öffnen:

```powershell
npm ci
npm run prepare:local-test
```

Danach zwei PowerShell-Fenster im selben Ordner verwenden.

Fenster 1:

```powershell
npm run server:local-test
```

Fenster 2:

```powershell
npm run dev
```

Im Browser `http://localhost:5173` öffnen. Alle lokalen Testkonten verwenden
das Passwort `NurLokal-2026!`:

- `Lukas` zeigt Cecilia.
- `Liras` zeigt Konohiko.
- `KaufhausSamurai` zeigt Mfmfmgm.
- `Test` zeigt den Testhelden und darf auch die Meisteransicht öffnen.

Die lokale Testdatenbank liegt ausschließlich unter `data/local-test.db`. Um
sie später bewusst neu zu erzeugen:

```powershell
npm run prepare:local-test -- --force
```

## Update auf den Raspberry Pi übertragen

Die ZIP-Datei auf dem Windows-PC nach `Downloads` legen und in PowerShell
übertragen:

```powershell
scp "$HOME\Downloads\DSA-komplettprojekt-2026-08-02.zip" simon@192.168.188.100:/home/simon/
ssh simon@192.168.188.100
```

Auf dem Pi:

```bash
rm -rf /home/simon/dsa-update-2026-08-02
mkdir -p /home/simon/dsa-update-2026-08-02
unzip /home/simon/DSA-komplettprojekt-2026-08-02.zip -d /home/simon/dsa-update-2026-08-02
bash /home/simon/dsa-update-2026-08-02/DSA/deploy/update-pi.sh
```

Das Skript führt selbstständig Folgendes aus:

1. API stoppen.
2. Datenbank, Uploads, bisherigen Projektcode und bisherige Website sichern.
3. Nur den Programmcode aktualisieren; `data/`, `.env`, `.git` und
   `node_modules/` bleiben geschützt.
4. Lint, Smoke-Test, Heldenimport-Test und Build ausführen.
5. Die vier geprüften Helden anhand von Benutzername und Helden-ID einspielen.
6. Website ausliefern, API starten und bis zu 30 Sekunden auf einen
   erfolgreichen Healthcheck warten.

Die Sicherung wird unter
`/home/simon/dsa-update-backups/JJJJ-MM-TT_HH-MM-SS/` angelegt. Wenn während
des Updates etwas fehlschlägt, stellt das Skript diesen Stand automatisch
wieder her.

## Kontrolle nach dem Update

```bash
sudo systemctl --no-pager --full status dsa-api
curl http://127.0.0.1:3000/api/health
```

Danach im Browser `http://192.168.188.100` öffnen und zuerst Cecilia sowie
Konohiko kontrollieren.

## Schnelles manuelles Rollback

Falls nach einem erfolgreichen Update später doch ein Problem auffällt:

```bash
bash /home/simon/apps/DSA/deploy/rollback-pi.sh
```

Ohne weiteren Parameter wird der zuletzt vor einem Update erzeugte Snapshot
verwendet. Das Rollback stellt Projektcode, Datenbank und ausgelieferte Website
wieder her. Uploads wurden durch das Update nicht verändert und bleiben daher
unangetastet; ihre zusätzliche Sicherung liegt trotzdem im Snapshot.

## Schutz vor versehentlichem Überschreiben

Der Heldenimport bricht ab, falls ein Held auf dem Pi nach dem verwendeten
Export nochmals geändert wurde. In diesem Fall nicht `--force` verwenden,
sondern die Helden erneut exportieren und neu migrieren lassen.
