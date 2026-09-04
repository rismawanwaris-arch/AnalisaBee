#!/bin/sh
set -e

echo "▶ Menunggu database siap..."
until npx prisma migrate deploy; do
  echo "  Database belum siap — coba lagi dalam 3 detik..."
  sleep 3
done

echo "▶ Menjalankan server..."
exec npm start
