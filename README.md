# DSA-Heldenbogen

React-Frontend mit zentraler Node.js-API und SQLite-Datenbank. Jeder Benutzer kann mehrere Helden anlegen, öffnen und bearbeiten. Anmeldung und Heldendaten werden auf dem Server gespeichert.

Der Heldenbogen besitzt einen geschützten Spielmodus für laufende Ressourcen und einen Setup-Modus für Grunddaten, Eigenschaften, Talente, Magie, Maximalwerte und Inventar. Helden können im Archiv nach einer Bestätigung wieder gelöscht werden.

Talente, Zauber, Gegenstände, Vor- und Nachteile sowie Sonderfertigkeiten besitzen ausführliche Detailansichten. Tradition und Prägungen stehen in der Übersicht; der Tab „Magie“ enthält Zauber, magische Sonderfertigkeiten, Zaubertricks und Traditionsgegenstände. Bestehende Heldendaten werden beim Laden automatisch um die neuen Bereiche ergänzt. Im Resistenz-Tab lassen sich Schutzwerte, Immunitäten und Schwächen samt Notizen erfassen.

Gegenstände können gezielt für die Körperansicht freigegeben und auf kompatible Plätze beschränkt werden. Ein Klick auf Kopf, Torso, Arme, Hände, Beine oder Füße zeigt nur die jeweils passenden Gegenstände. Gürtel und Rücken nehmen mehrere Gegenstände auf; derselbe Inventargegenstand kann beispielsweise gleichzeitig an beiden Händen oder Füßen getragen werden. Ausgerüstete Körperzonen werden an der Figur hervorgehoben. Körperänderungen werden protokolliert; vom Meister gesetzte Statuseffekte besitzen eine deutlich rote Warnmarkierung.

Die Körperfreigabe ist bei allen Gegenständen standardmäßig ausgeschaltet. Im Setup-Modus lässt sie sich direkt in der normalen Ausrüstungsliste aktivieren; anschließend werden die zulässigen Plätze ausgewählt. Arme, Beine und Füße sind in linke und rechte Plätze getrennt.

Talente zeigen ihre drei Eigenschaftsproben, während eine kompakte Eigenschaftsübersicht über Talenten und Zaubern den direkten Vergleich erleichtert. Die geschützte Würfelseite bietet W4, W6, W8, W10, W12, W20 und W100 sowie frei wählbare Würfelanzahl, Seitenzahl und Modifikator.

Talent- und Zauberproben können direkt als 3W20-Probe ausgeführt werden. Die Auswertung zeigt jeden Einzelwurf, die verbrauchten Fertigkeitspunkte, Erfolg oder Misserfolg und die erreichte Qualitätsstufe. Erleichterungen und Erschwernisse lassen sich vor dem Wurf einstellen.

Der Kampf-Tab verwaltet Seelenkraft, Zähigkeit, Ausweichen, Initiative, Geschwindigkeit und Rüstungsschutz sowie Kampftechniken. AT und PA stehen weiterhin an den einzelnen Waffen beziehungsweise Kampftechniken. Waffen, Schilde und Rüstungen werden als Inventargegenstände gespeichert und erscheinen mit ihren kampfrelevanten Werten automatisch auch im Kampfbereich. Ein eigener Tab erfasst Vorteile und Nachteile mitsamt Stufen, AP-Werten, Regeltexten und Voraussetzungen. Sprachen und Schriften stehen bei den Talenten zur Verfügung. Die Übersicht enthält einen Geldbeutel für Dukaten, Silbertaler und Heller.

## Meisteransicht

Spieler können einen Helden im Heldenbogen als „In der Sitzung“ markieren. Meister sehen unter `/meister` alle aktiven Helden mit Spielername, LeP, AsP und Anzahl der Statuseffekte. Ein Klick öffnet den vollständigen Heldenbogen schreibgeschützt. Nur im Körperbereich darf der Meister eigene Statuseffekte setzen oder wieder entfernen. Diese erscheinen beim Spieler mit einer roten Meistermarkierung und werden innerhalb weniger Sekunden synchronisiert.

Auf der Anmeldeseite kann zwischen Spieler- und Meisteransicht gewählt werden. Ein freigeschaltetes Meisterkonto kann außerdem über die Seitenleiste jederzeit zwischen beiden Ansichten wechseln. Die Auswahl ändert nur die Ansicht; normale Spielerkonten können sich dadurch keine Meisterrechte geben.

Neue Benutzer sind immer normale Spieler. Die eigentliche Meisterberechtigung wird ausschließlich lokal auf dem Server vergeben:

```bash
cd ~/apps/DSA
npm run set-role -- Simon master
```

Zum Zurücksetzen auf einen Spieler:

```bash
npm run set-role -- Simon player
```

Nach einer Rollenänderung muss sich der Benutzer einmal ab- und wieder anmelden.

Unter `/meister/server` zeigt der Pi-Status CPU-Auslastung und Load, Arbeitsspeicher, Datenträger, Temperatur, Laufzeiten sowie die Größe von Prozess und Datenbank. Die Werte werden alle fünf Sekunden aktualisiert und serverseitig zwischengespeichert, damit die Statusseite selbst nur sehr wenig Last erzeugt.

## Handouts

Unter `/meister/handouts` bereitet der Meister Briefe, Hinweise, Porträts, Dokumente und andere Illustrationen als PNG, JPG, JPEG oder SVG vor. Jedes Handout kann für alle Spieler oder nur für ein bestimmtes Spielerkonto bestimmt, zunächst als Entwurf gespeichert, hervorgehoben und während der Sitzung gezielt freigegeben oder wieder zurückgezogen werden.

Spieler finden freigegebene Inhalte unter `/handouts`. Die Ansicht aktualisiert sich automatisch, bietet Filter nach Materialart und öffnet Bilder in einer bildschirmfüllenden Präsentationsansicht. Frisch enthüllte Inhalte werden 15 Minuten lang als neu markiert; ein Download des Originalbildes ist ebenfalls möglich.

Handout-Dateien dürfen höchstens 12 MB groß sein. SVG-Dateien werden vor dem Speichern auf aktive oder externe Inhalte geprüft und bei der Auslieferung zusätzlich durch eine restriktive Content-Security-Policy abgeschirmt.

## Karten- und Fernseheransicht

Unter `/meister/karte` verwaltet der Meister mehrere benannte Karten und bestimmt, welche davon gerade für Spieler und Fernseher aktiv ist. Eine bereits vorhandene Einzelkarte wird beim ersten Start automatisch samt Nebel und Tokenpositionen als „Karte 1“ übernommen. Kartenbilder dürfen PNG, JPG oder WebP und höchstens 20 MB groß sein.

Der Nebel lässt sich mit runden Pinseln oder Rechtecken aufdecken und wieder verbergen. Die Pinselgröße ist einstellbar; Rückgängig, Wiederholen, „Alles aufdecken“ und „Alles verbergen“ ergänzen die Werkzeugleiste. Der Zoom reicht von 10 bis 300 Prozent und die Schaltfläche „An Bildschirm anpassen“ zeigt auch große oder hochformatige Karten vollständig.

Öffentliche oder geheime Pins markieren Shops, Tavernen, Orte, NPCs, Quests, Schätze, Übergänge und Fallen. Der Meister kann außerdem sichtbare oder geheime Monster mit eigenen LeP, AsP, Notizen und Tokenbildern einsetzen und bewegen. Aktive Helden und Monster zeigen je nach Karteneinstellung genaue LeP-/AsP-Werte, nur Balken oder keine Ressourcen. Geheime Pins und Monster bleiben in der Spieleransicht verborgen.

Jeder Spieler kann im Heldenbogen ein eigenes PNG-, JPG- oder WebP-Token bis 2 MB hochladen. Die bildschirmfüllende Route `/karte/anzeige` ist für einen Fernseher gedacht, aktualisiert sich automatisch und zeigt unbekannte Bereiche schwarz. Die Anzeige setzt aus Sicherheitsgründen eine angemeldete Sitzung voraus.

Die Fernseheransicht fragt zunächst nur die Kartenrevision ab und lädt den vollständigen Zustand erst nach einer Änderung. Kartenbilder werden gestreamt und langfristig im Browser zwischengespeichert. Pinselzüge werden als kompakte SVG-Pfade gerendert, damit auch große Nebelmasken auf schwächeren Geräten flüssig bleiben.

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

Für das vorbereitete Updatepaket mit automatischem Backup, geprüftem
Heldenimport und Rollback gilt die separate [Update-Anleitung](UPDATE-ANLEITUNG.md).

```bash
cd ~/apps/DSA
npm ci
npm run lint
npm run test:smoke
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

Die Datenbank und hochgeladenen Bilddateien liegen auf dem Pi unter:

```text
/home/simon/apps/DSA/data/dsa.db
/home/simon/apps/DSA/data/uploads/
```

Für ein konsistentes manuelles Backup:

```bash
mkdir -p ~/backups
sqlite3 ~/apps/DSA/data/dsa.db ".backup '$HOME/backups/dsa-$(date +%F).db'"
tar -czf "$HOME/backups/dsa-uploads-$(date +%F).tar.gz" -C ~/apps/DSA data/uploads
```

Die Dateien `.env`, `data/` und `*.db` werden bewusst nicht versioniert.

## Sicherheit

- Passwörter werden mit `scrypt` und individuellem Salt gespeichert.
- Sitzungen verwenden zufällige Token in `HttpOnly`- und `SameSite=Strict`-Cookies.
- Die API lauscht nur auf `127.0.0.1`; Zugriffe laufen über Nginx.
- Karten dürfen höchstens 20 MB, Handouts höchstens 12 MB sowie Helden- und Monstertokens höchstens 2 MB groß sein. Der Server prüft Dateityp und Dateisignatur; SVG-Handouts werden zusätzlich auf gefährliche Inhalte geprüft.
- Für einen späteren Internetzugriff muss HTTPS eingerichtet und `COOKIE_SECURE=true` gesetzt werden.
