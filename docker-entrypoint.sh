#!/bin/sh
set -e

echo "Menjalankan migrasi database..."
npx prisma migrate deploy

echo "Migrasi selesai, menjalankan aplikasi..."
exec "$@"
