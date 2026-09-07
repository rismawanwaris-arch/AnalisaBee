#!/bin/sh
# Restores the AnalisaBEe Postgres database from a backup made by
# backup-db.sh. DESTRUCTIVE — drops and recreates every table in the target
# database before loading the dump. Confirms before doing anything.
#
# Usage: ./scripts/restore-db.sh backups/analisabee-20260907-020000.sql.gz
set -e

cd "$(dirname "$0")/.."

FILE="$1"
if [ -z "$FILE" ] || [ ! -f "$FILE" ]; then
  echo "Usage: $0 <path-to-backup.sql.gz>" >&2
  echo "Backup yang tersedia:" >&2
  ls -la backups/*.sql.gz 2>/dev/null >&2 || echo "  (folder backups/ kosong atau belum ada)" >&2
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "✗ Tidak menemukan 'docker compose' atau 'docker-compose'." >&2
  exit 1
fi

echo "⚠️  Ini akan MENIMPA seluruh isi database saat ini dengan isi $FILE"
printf "Lanjutkan? (ketik 'ya' untuk konfirmasi): "
read -r CONFIRM
if [ "$CONFIRM" != "ya" ]; then
  echo "Dibatalkan."
  exit 1
fi

# shellcheck disable=SC2086
gunzip -c "$FILE" | $COMPOSE exec -T db psql -U "${POSTGRES_USER:-analisabee}" "${POSTGRES_DB:-analisabee}"

echo "✔ Restore selesai dari $FILE"
