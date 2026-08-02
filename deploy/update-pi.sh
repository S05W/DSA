#!/usr/bin/env bash
set -Eeuo pipefail

SOURCE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_ROOT="${DSA_TARGET_ROOT:-/home/simon/apps/DSA}"
BACKUP_ROOT="${DSA_BACKUP_ROOT:-/home/simon/dsa-update-backups}"
WEB_ROOT="${DSA_WEB_ROOT:-/var/www/dsa}"
HERO_FILE="$SOURCE_ROOT/deploy/helden/alle-helden-neue-struktur.json"
STAMP="$(date '+%Y-%m-%d_%H-%M-%S')"
SNAPSHOT="$BACKUP_ROOT/$STAMP"
ROLLBACK_READY=0
SERVICE_STOPPED=0

for command_name in node npm rsync tar curl; do
  command -v "$command_name" >/dev/null || { echo "Fehlendes Programm: $command_name" >&2; exit 1; }
done

case "$TARGET_ROOT" in
  /|/home|/home/simon|/home/simon/apps) echo "Unsicherer Zielpfad: $TARGET_ROOT" >&2; exit 1 ;;
esac
case "$BACKUP_ROOT" in
  /|/home|/home/simon) echo "Unsicherer Backuppfad: $BACKUP_ROOT" >&2; exit 1 ;;
esac
case "$WEB_ROOT" in
  /|/var|/var/www) echo "Unsicherer Webpfad: $WEB_ROOT" >&2; exit 1 ;;
esac

[[ "$SOURCE_ROOT" != "$TARGET_ROOT" ]] || { echo "Update zuerst in einen separaten Ordner entpacken." >&2; exit 1; }
[[ -f "$SOURCE_ROOT/package.json" && -f "$SOURCE_ROOT/server/server.mjs" ]] || { echo "Updatepaket ist unvollständig." >&2; exit 1; }
[[ -f "$HERO_FILE" ]] || { echo "Migrierte Heldendatei fehlt: $HERO_FILE" >&2; exit 1; }
[[ -f "$TARGET_ROOT/package.json" && -f "$TARGET_ROOT/data/dsa.db" ]] || { echo "Bestehende DSA-Installation nicht gefunden: $TARGET_ROOT" >&2; exit 1; }

if [[ -s /home/simon/.nvm/nvm.sh ]]; then
  # shellcheck disable=SC1091
  source /home/simon/.nvm/nvm.sh
  nvm use 24 >/dev/null
fi

restore_snapshot() {
  local restore_code restore_web
  echo "Update fehlgeschlagen. Der vorherige Stand wird automatisch wiederhergestellt." >&2
  sudo systemctl stop dsa-api.service >/dev/null 2>&1 || true

  if [[ -f "$SNAPSHOT/dsa.db" ]]; then
    cp -a "$SNAPSHOT/dsa.db" "$TARGET_ROOT/data/dsa.db"
    rm -f "$TARGET_ROOT/data/dsa.db-wal" "$TARGET_ROOT/data/dsa.db-shm"
  fi

  if [[ -f "$SNAPSHOT/project-code.tar.gz" ]]; then
    restore_code="$(mktemp -d)"
    tar -xzf "$SNAPSHOT/project-code.tar.gz" -C "$restore_code"
    rsync -a --delete \
      --exclude='/data/' \
      --exclude='/.git/' \
      --exclude='/node_modules/' \
      "$restore_code/" "$TARGET_ROOT/"
    rm -rf -- "$restore_code"
  fi

  if [[ -f "$SNAPSHOT/web-root.tar.gz" ]]; then
    restore_web="$(mktemp -d)"
    tar -xzf "$SNAPSHOT/web-root.tar.gz" -C "$restore_web"
    sudo mkdir -p "$WEB_ROOT"
    sudo rsync -a --delete "$restore_web/" "$WEB_ROOT/"
    rm -rf -- "$restore_web"
  fi

  sudo systemctl start dsa-api.service >/dev/null 2>&1 || true
  echo "Wiederhergestellt aus: $SNAPSHOT" >&2
}

on_exit() {
  local status=$?
  if [[ $status -ne 0 ]]; then
    if [[ $ROLLBACK_READY -eq 1 ]]; then
      restore_snapshot
    elif [[ $SERVICE_STOPPED -eq 1 ]]; then
      sudo systemctl start dsa-api.service >/dev/null 2>&1 || true
    fi
  fi
  exit "$status"
}
trap on_exit EXIT

mkdir -p "$SNAPSHOT"
sudo systemctl stop dsa-api.service
SERVICE_STOPPED=1

if command -v sqlite3 >/dev/null; then
  sqlite3 "$TARGET_ROOT/data/dsa.db" ".backup '$SNAPSHOT/dsa.db'"
else
  cp -a "$TARGET_ROOT/data/dsa.db" "$SNAPSHOT/dsa.db"
fi

if [[ -d "$TARGET_ROOT/data/uploads" ]]; then
  tar -czf "$SNAPSHOT/uploads.tar.gz" -C "$TARGET_ROOT" data/uploads
fi
tar -czf "$SNAPSHOT/project-code.tar.gz" \
  --exclude='./data' \
  --exclude='./node_modules' \
  --exclude='./.git' \
  -C "$TARGET_ROOT" .
if [[ -d "$WEB_ROOT" ]]; then
  sudo tar -czf "$SNAPSHOT/web-root.tar.gz" -C "$WEB_ROOT" .
  sudo chown "$(id -u):$(id -g)" "$SNAPSHOT/web-root.tar.gz"
fi
printf '%s\n' \
  "DSA-Snapshot vor Update" \
  "Zeitpunkt: $STAMP" \
  "Quellpaket: $SOURCE_ROOT" \
  "Installation: $TARGET_ROOT" \
  > "$SNAPSHOT/README.txt"
ln -sfn "$SNAPSHOT" "$BACKUP_ROOT/latest"
ROLLBACK_READY=1

rsync -a --delete \
  --exclude='/data/' \
  --exclude='/.env' \
  --exclude='/.git/' \
  --exclude='/node_modules/' \
  "$SOURCE_ROOT/" "$TARGET_ROOT/"

cd "$TARGET_ROOT"
if [[ ! -x node_modules/.bin/vite ]]; then
  npm ci
fi
npm run lint
npm run test:smoke
npm run test:import -- deploy/helden/alle-helden-neue-struktur.json
npm run build
npm run import:heroes -- deploy/helden/alle-helden-neue-struktur.json

sudo mkdir -p "$WEB_ROOT"
sudo rsync -a --delete "$TARGET_ROOT/dist/" "$WEB_ROOT/"
sudo systemctl start dsa-api.service
SERVICE_STOPPED=0
sudo systemctl reload nginx

API_READY=0
for attempt in {1..30}; do
  if curl --fail --silent --show-error http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    API_READY=1
    break
  fi
  sleep 1
done

if [[ $API_READY -ne 1 ]]; then
  echo "Die DSA-API war nach 30 Sekunden noch nicht erreichbar." >&2
  sudo systemctl --no-pager --full status dsa-api.service >&2 || true
  sudo journalctl -u dsa-api.service -n 80 --no-pager >&2 || true
  exit 1
fi

ROLLBACK_READY=0
echo "Update erfolgreich. Backup: $SNAPSHOT"
