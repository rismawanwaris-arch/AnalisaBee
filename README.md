# AnalisaBEe

Dashboard analisa data penjualan dari export Excel POS, untuk dua cabang (Bandung & Cimahi).
Upload file `.xls`/`.xlsx` periodik, data disimpan permanen di database sehingga bisa
dianalisa lintas bulan — bukan sekadar dibaca sekali lalu hilang. Lihat
[BLUEPRINT.md](BLUEPRINT.md) untuk arsitektur & aturan domain lengkap.

## Fitur saat ini

- **Import Data** — upload file Excel penjualan (per cabang), otomatis dedup baris yang
  sudah pernah diimpor (aman diunggah ulang), riwayat setiap import tersimpan. Katalog item
  per cabang dikelola terpisah lewat import "Master Item".
- **Dashboard** — KPI dengan tren & sparkline, chart omzet/laba harian, top 10 item & outlet,
  filter tanggal + outlet, per cabang.
- **Laporan Target Harian** — pencapaian per outlet vs target (harian atau rentang tanggal),
  per kategori (Server/Tartun/Petshop/Aksesoris/SP-Voucher), export Excel & JPEG.
- **Poin & Insentif Penjualan** — leaderboard poin pegawai per periode (harian/mingguan/
  bulanan/rentang custom), rincian per item, export Excel. Bandung terpisah jadi dua menu
  (Aksesoris & Petshop) karena dua lini produk berbeda. Ada juga **Papan Poin** publik
  (tanpa login, untuk TV/tablet di outlet).
- **Item & SKU / Kategori Item** — cari & telusuri satu item lintas outlet/tanggal, atau
  lihat performa per kategori. Item/outlet/pegawai bisa disembunyikan dari seluruh analisa
  (tanpa menghapus data penjualannya).
- **Performa Outlet & Pegawai** — halaman performa per outlet dan per pegawai.
- **Analisa Data** — gabungan Penjualan/Tarik Tunai/Komisi Server dalam satu tabel, dengan
  hapus massal.
- **Akun & Peran** — multi-user (`master`/`admin`), peran kustom per fitur untuk akun admin,
  log aktivitas, backup/restore data & pengaturan.

## Stack

Vite + React 19 (SPA) · Express (API server, satu proses dengan SPA di produksi) ·
PostgreSQL · Prisma 7 (driver adapter, tanpa native binary) · Tailwind v4 · Recharts ·
React Query. **Bukan Next.js** — lihat [BLUEPRINT.md §2](BLUEPRINT.md#2-stack).

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
prisma/schema.prisma         Skema database (Outlet, Item, Employee, ImportBatch, Sale, ...)
src/lib/parseExcel.ts        Parser file Excel penjualan → baris ternormalisasi
src/lib/importSales.ts       Import baris ke database (dedup via rowHash)
src/lib/queries/*.ts         Query agregasi — satu file per domain, dipakai oleh server/routes
src/server/index.ts          Entry point Express: setup app, mount semua router, listen
src/server/middleware.ts     Auth guard (requireAuth/requireMaster/requireFeature), logActivity
src/server/routes/*.ts       Satu file per domain API — lihat BLUEPRINT.md §7 untuk peta lengkap
src/pages/*                  Halaman (Dashboard, Target, Poin, Item, Outlet, Pegawai, Import, ...)
src/components/*             Komponen UI (chart, KPI card, tabel, modal, dll)
```

Setiap fitur baru pada dasarnya: 1 tabel/relasi baru (jika perlu) → 1 fungsi di
`lib/queries` → 1 endpoint di `server/routes/<domain>.ts` yang sesuai → 1 halaman/komponen.
Detail lengkap alur kerja + jebakan yang sudah pernah menggigit ada di
[BLUEPRINT.md §12](BLUEPRINT.md#12-menambah-fitur-baru--urutan-kerja).

## Deploy ke ZimaOS (Docker)

Aplikasi berjalan sebagai 2 container (app + Postgres) lewat `docker-compose.yml`, migrasi
database berjalan otomatis setiap container start.

1. Salin folder proyek ini ke NAS (atau `git clone` jika sudah didorong ke suatu remote).
2. Salin `.env.example` menjadi `.env`, ganti `POSTGRES_PASSWORD` dengan password sendiri.
3. Jalankan lewat SSH (di ZimaOS, `docker compose` — dengan spasi — kadang tidak terpasang;
   pakai binary `docker-compose` kalau begitu):

   ```bash
   docker-compose up -d --build
   ```

4. Aplikasi tersedia di `http://<ip-nas>:8080` (port bisa diganti lewat `APP_PORT` di `.env`).

Untuk update ke versi baru: tarik/salin kode terbaru, lalu `docker-compose up -d --build` —
migrasi database berjalan otomatis, data lama tidak hilang. **Jangan pernah** jalankan
`docker-compose down -v` — flag `-v` menghapus juga folder data database.

### Penyimpanan data — bind-mount, bukan Docker volume

`pgdata/` (data Postgres) sengaja di-bind-mount ke folder biasa di sebelah proyek ini
(`./pgdata:/var/lib/postgresql/data`), **bukan** Docker named volume. Alasannya: pada
2026-09-07, sebuah named volume produksi terhapus permanen akibat operasi `rm -rf` yang
sebetulnya menyasar path lain — datanya tersembunyi di dalam data-root Docker sehingga tidak
disadari ikut terhapus. Bind-mount membuat data terlihat sebagai folder biasa (`ls pgdata/`
langsung menunjukkan isinya), jadi jauh lebih sulit terhapus tanpa disadari, dan gampang
disalin/backup seperti file biasa.

**Migrasi dari deployment lama** (yang masih pakai Docker volume `analisabee_pgdata`): kalau
volume lama itu masih ada isinya, salin datanya ke `./pgdata` dulu sebelum `docker-compose up`
pertama kali dengan compose file baru ini:

```bash
docker run --rm -v analisabee_pgdata:/from -v "$(pwd)/pgdata":/to alpine sh -c "cp -av /from/. /to/"
```

Kalau volume lamanya sudah kosong/tidak ada (mis. baru deploy dari awal, atau data lama sudah
hilang), lewati langkah ini — Postgres otomatis membuat database baru yang kosong di `./pgdata`
saat pertama kali start.

### Backup

Backup terjadwal, otomatis, dan independen dari kondisi container — lihat `scripts/backup-db.sh`
(dump ter-gzip + rotasi otomatis, hapus yang lebih tua dari 14 hari) dan `scripts/restore-db.sh`
untuk memulihkannya. Jadwalkan lewat cron di host (bukan di dalam container):

```bash
crontab -e
# tambahkan baris ini (backup tiap hari jam 2 pagi):
0 2 * * * cd ~/Documents/AnalisaBEe && ./scripts/backup-db.sh >> backups/backup.log 2>&1
```

Backup tersimpan di `backups/analisabee-<timestamp>.sql.gz`. Sesekali salin folder ini keluar
dari server (laptop, cloud storage, dll) — backup yang cuma ada di disk yang sama dengan
datanya tidak melindungi dari kegagalan disk itu sendiri.

## Belum ada (sadar, bukan lupa)

Perbandingan Year-over-Year, alert item slow-moving/stok (tidak ada data stok dari POS),
global search. Daftar lengkap + alasan tiap satu ada di
[BLUEPRINT.md §11](BLUEPRINT.md#11-batasan-saat-ini-sadar-bukan-lupa). Prioritas
menyesuaikan kebutuhan yang muncul saat dipakai sehari-hari, bukan roadmap tetap.
