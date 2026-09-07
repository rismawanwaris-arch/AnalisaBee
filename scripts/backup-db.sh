#!/bin/sh
# Dumps the AnalisaBEe Postgres database to a timestamped, gzipped file under
# ./backups, and prunes backups older than $RETENTION_DAYS (default 14).
#
# Runs pg_dump *inside* the running "db" container via compose exec, so it
# always matches whatever's actually live — no need to know container names,
# credentials, or host/port. Meant to be run from HOST cron (not from inside
# a container), e.g.:
#
#   0 2 * * * cd ~/Documents/AnalisaBEe && ./scripts/backup-db.sh >> backups/backup.log 2>&1
#
# Why this exists: on 2026-09-07 the Postgres data (a Docker named volume)
# was permanently lost to an unrelated `rm -rf` on a Docker internal path.
# The volume is now a bind-mount (see docker-compose.yml) so the *live* data
# is a plain, visible folder — but a scheduled dump here is what actually
# survives a human mistake, a bad `docker-compose down -v`, or disk failure,
# since it's a separate, independent copy taken on its own schedule.
set -e

cd "$(dirname "$0")/.."

RETENTION_DAYS="${RETENTION_DAYS:-14}"
BACKUP_DIR="$(pwd)/backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
FILE="$BACKUP_DIR/analisabee-$TIMESTAMP.sql.gz"

# Prefer the `docker compose` plugin; fall back to the standalone
# `docker-compose` binary (that's what's actually installed on the ZimaOS
# deployment host, at /DATA/bin/docker-compose).
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "✗ Tidak menemukan 'docker compose' atau 'docker-compose'." >&2
  exit 1
fi

# Dump to a plain temp file first and check its exit code explicitly — piping
# `pg_dump | gzip` directly would let a failed pg_dump silently produce a
# tiny "successful" gzip of an error message, since plain `sh` (unlike bash)
# has no `pipefail` to catch a failure in the middle of a pipe.
TMP_SQL=$(mktemp)
trap 'rm -f "$TMP_SQL"' EXIT

# shellcheck disable=SC2086 # $COMPOSE is intentionally two words for the plugin case
if ! $COMPOSE exec -T db pg_dump -U "${POSTGRES_USER:-analisabee}" "${POSTGRES_DB:-analisabee}" > "$TMP_SQL"; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') ✗ pg_dump GAGAL — backup dibatalkan, tidak ada file yang ditulis/ditimpa." >&2
  exit 1
fi

if [ ! -s "$TMP_SQL" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') ✗ pg_dump menghasilkan file kosong — backup dibatalkan (dianggap gagal)." >&2
  exit 1
fi

gzip -c "$TMP_SQL" > "$FILE"

SIZE=$(du -h "$FILE" | cut -f1)
echo "$(date '+%Y-%m-%d %H:%M:%S') ✔ Backup tersimpan: $FILE ($SIZE)"

DELETED=$(find "$BACKUP_DIR" -name "analisabee-*.sql.gz" -mtime "+$RETENTION_DAYS" -print -delete)
if [ -n "$DELETED" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') 🗑 Backup lama dihapus (> ${RETENTION_DAYS} hari):"
  echo "$DELETED"
fi
