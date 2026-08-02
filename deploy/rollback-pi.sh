#!/usr/bin/env bash
set -Eeuo pipefail

TARGET_ROOT="${DSA_TARGET_ROOT:-/home/simon/apps/DSA}"
BACKUP_ROOT="${DSA_BACKUP_ROOT:-/home/simon/dsa-update-backups}"
WEB_ROOT="${DSA_WEB_ROOT:-/var/www/dsa}"
SNAPSHOT_INPUT="${1:-$BACKUP_ROOT/latest}"

case "$TARGET_ROOT" in
  /|/home|/home/simon|/home/simon/apps) echo "Unsicherer Zielpfad: $TARGET_ROOT" >&2; exit 1 ;;
esac
case "$BACKUP_ROOT" in
  /|/home|/home/simon) echo "Unsicherer Backuppfad: $BACKUP_ROOT" >&2; exit 1 ;;
esac
case "$WEB_ROOT" in
  /|/var|/var/www) echo "Unsicherer Webpfad: $WEB_ROOT" >&2; exit 1 ;;
esac

[[ -e "$SNAPSHOT_INPUT" ]] || { echo "Backup nicht gefunden: $SNAPSHOT_INPUT" >&2; exit 1; }
SNAPSHOT="$(realpath "$SNAPSHOT_INPUT")"
RESOLVED_BACKUP_ROOT="$(realpath "$BACKUP_ROOT")"
[[ "$SNAPSHOT" == "$RESOLVED_BACKUP_ROOT"/* ]] || { echo "Backup liegt außerhalb des erlaubten Ordners." >&2; exit 1; }
[[ -f "$SNAPSHOT/dsa.db" && -f "$SNAPSHOT/project-code.tar.gz" ]] || { echo "Backup ist unvollständig: $SNAPSHOT" >&2; exit 1; }

RESTORE_CODE="$(mktemp -d)"
RESTORE_WEB="$(mktemp -d)"
cleanup() { rm -rf -- "$RESTORE_CODE" "$RESTORE_WEB"; }
trap cleanup EXIT

sudo systemctl stop dsa-api.service
cp -a "$SNAPSHOT/dsa.db" "$TARGET_ROOT/data/dsa.db"
rm -f "$TARGET_ROOT/data/dsa.db-wal" "$TARGET_ROOT/data/dsa.db-shm"

tar -xzf "$SNAPSHOT/project-code.tar.gz" -C "$RESTORE_CODE"
rsync -a --delete \
  --exclude='/data/' \
  --exclude='/.git/' \
  --exclude='/node_modules/' \
  "$RESTORE_CODE/" "$TARGET_ROOT/"

if [[ -f "$SNAPSHOT/web-root.tar.gz" ]]; then
  tar -xzf "$SNAPSHOT/web-root.tar.gz" -C "$RESTORE_WEB"
  sudo mkdir -p "$WEB_ROOT"
  sudo rsync -a --delete "$RESTORE_WEB/" "$WEB_ROOT/"
fi

sudo systemctl start dsa-api.service
sudo systemctl reload nginx
echo "Rollback erfolgreich: $SNAPSHOT"
