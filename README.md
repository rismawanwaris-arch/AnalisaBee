# AnalisaBEe

Dashboard analisa data penjualan dari export Excel POS. Upload file `.xls`/`.xlsx` bulanan,
data disimpan permanen di database sehingga bisa dianalisa lintas bulan — bukan sekadar
dibaca sekali lalu hilang.

## Fitur saat ini

- **Import Data** — upload file Excel, otomatis dedup baris yang sudah pernah diimpor (aman
  diunggah ulang), riwayat setiap import tersimpan.
- **Item Lookup** — cari satu item, lihat terjual di outlet mana, berapa pcs, tanggal berapa
  (dengan filter rentang tanggal, chart per outlet, export CSV).
- **Dashboard** — KPI dengan tren & sparkline, chart omzet/laba harian, leaderboard top 10
  item & outlet, filter global tanggal + outlet.
- **Outlet & Pegawai** — halaman performa per outlet dan per pegawai.

## Stack

Next.js 16 (App Router) · PostgreSQL · Prisma 7 (driver adapter, tanpa native binary) ·
Tailwind v4 · Recharts · next-themes (dark/light).

## Development

Butuh Postgres lokal. Docker **tidak wajib** — dipakai hanya untuk deploy produksi ke ZimaOS,
bukan untuk aplikasinya sendiri saat development.

### Opsi A — Postgres native (Postgres.app), tanpa Docker

Paling ringan untuk RAM (tidak ada VM Docker Desktop di background). Sekali setup:

1. Install [Postgres.app](https://postgresapp.com), buka, klik **Initialize**.
2. Buat role & database sekali saja (samakan dengan `DATABASE_URL` di `.env`):

   ```bash
   PATH="/Applications/Postgres.app/Contents/Versions/latest/bin:$PATH" \
     psql -h localhost -p 5432 -U "$(whoami)" -d postgres -v ON_ERROR_STOP=1 -c \
     "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='analisabee') THEN CREATE ROLE analisabee LOGIN PASSWORD 'analisabee'; END IF; END \$\$;" \
     -c "SELECT 'CREATE DATABASE analisabee OWNER analisabee' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname='analisabee')\gexec"
   ```

3. Jalankan seperti biasa:

   ```bash
   npx prisma migrate deploy
   npm run dev
   ```

Setiap hari cukup buka Postgres.app (atau set auto-start di System Settings), lalu `npm run dev`.

### Opsi B — Postgres via Docker

Kalau lebih suka Docker (mis. mau environment yang identik dengan produksi):

```bash
docker compose -f docker-compose.dev.yml up -d
npx prisma migrate dev
npm run dev
```

Buka http://localhost:3000.

## Struktur proyek

```
prisma/schema.prisma        Skema database (Outlet, Item, Employee, ImportBatch, Sale)
src/lib/parseExcel.ts       Parser file Excel → baris ternormalisasi
src/lib/importSales.ts      Import baris ke database (dedup via rowHash)
src/lib/queries/*.ts        Query agregasi, dipakai bareng oleh API route & server page
src/app/api/*               API routes
src/app/*                   Halaman (dashboard, items, outlets, employees, import)
src/components/*            Komponen UI (chart, KPI card, leaderboard, dll)
```

Setiap fitur baru pada dasarnya: 1 tabel/relasi baru (jika perlu) → 1 fungsi di
`lib/queries` → 1 API route → 1 halaman. Tidak perlu mengubah fondasi yang ada.

## Deploy ke ZimaOS (Docker)

Aplikasi berjalan sebagai 2 container (app + Postgres) lewat `docker-compose.yml`, migrasi
database berjalan otomatis setiap container start.

1. Salin folder proyek ini ke NAS (atau `git clone` jika sudah didorong ke suatu remote).
2. Salin `.env.example` menjadi `.env`, ganti `POSTGRES_PASSWORD` dengan password sendiri.
3. Di ZimaOS, gunakan menu **Install a customized app / docker-compose** dan arahkan ke
   `docker-compose.yml` di folder proyek — atau jalankan manual lewat SSH:

   ```bash
   docker compose up -d --build
   ```

4. Aplikasi tersedia di `http://<ip-nas>:3000` (port bisa diganti lewat `APP_PORT` di `.env`).

Untuk update ke versi baru: tarik/salin kode terbaru, lalu `docker compose up -d --build` —
migrasi database berjalan otomatis, data lama tidak hilang (tersimpan di volume
`analisabee_db_data`).

### Backup

Data hidup di volume Docker `analisabee_db_data`. Backup rutin dengan:

```bash
docker exec analisabee-db-1 pg_dump -U analisabee analisabee > backup.sql
```

## Roadmap

- **Fase 2**: perbandingan antar bulan, filter grup item pada dashboard.
- **Fase 3**: export laporan terjadwal, alert item slow-moving.

Prioritas menyesuaikan kebutuhan yang muncul saat dipakai sehari-hari.
