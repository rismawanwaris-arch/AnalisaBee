# AnalisaBEe — Blueprint Teknis

Dokumen acuan arsitektur, model data, dan aturan domain untuk **AnalisaBEe** —
aplikasi analisa data penjualan dari export Excel POS milik CV. Asya Bisnis
Indonesia (jaringan outlet konter HP & petshop, dua cabang: **Bandung** dan
**Cimahi**, masing-masing dengan katalog item, target, dan (khusus Bandung)
sistem poin sendiri).

Dokumen pendamping:
- [`design.md`](design.md) — design system visual (token warna, tipografi, komponen).
- [`README.md`](README.md) — cara menjalankan project & deploy.

---

## 1. Tujuan & Prinsip

**Masalah yang dipecahkan:** data POS keluar dalam bentuk file Excel per periode.
Tanpa alat bantu, data itu hanya bisa dibaca sekali lalu hilang konteksnya —
tidak bisa dibandingkan lintas bulan, tidak bisa ditelusuri per item/outlet/pegawai.

**Prinsip arsitektur:**

1. **Akumulatif, bukan overwrite.** Setiap import menambah data ke database
   permanen. File yang sama boleh diunggah ulang tanpa merusak data (lihat
   dedup di §5). Ini berbeda dari pendekatan "satu file = satu laporan".
2. **Angka mentah disimpan apa adanya.** `Sale` mencerminkan baris Excel 1:1.
   Semua turunan (margin, poin, capaian target) dihitung saat query, bukan
   disimpan — supaya perubahan aturan tidak butuh migrasi data.
3. **Aturan bisnis bisa diubah pemilik tanpa deploy.** Poin per item, target
   harian, mapping outlet/item-group semuanya baris database yang bisa diedit
   lewat UI (Settings), bukan konstanta di kode.
4. **Jangan tampilkan angka yang tidak punya data pendukung.** Kalau sumber
   datanya tidak ada, fiturnya tidak dibuat — bukan diisi placeholder.
5. **Data kritis tidak boleh hilang secara diam-diam.** Lihat §10 (bind-mount,
   bukan Docker volume) — pelajaran dari insiden nyata, bukan kehati-hatian teoretis.

---

## 2. Stack

Ini **bukan** Next.js — sebuah versi awal project ini pernah dimulai di atas
Next.js, tapi arsitekturnya berpindah ke SPA + API server terpisah. Kalau
menemukan referensi Next.js di tempat lain (komentar lama, chat history), itu
sudah usang.

| Lapisan | Teknologi | Catatan |
|---|---|---|
| Frontend | Vite + React 19 (SPA, client-side routing via `react-router-dom`) | Build statis (`dist/`), di-serve oleh Express sendiri saat produksi |
| Backend | Node.js + Express 5 (`src/server/`) | Satu proses, satu deploy — lihat §7 untuk peta modul |
| UI | Tailwind v4, Recharts, React Query (dipilih untuk halaman tersibuk) | Tailwind v4 pakai `@theme inline`, bukan `tailwind.config.js` |
| ORM | Prisma 7 + `@prisma/adapter-pg` | Wajib driver adapter; koneksi via connection string langsung tidak lagi didukung |
| Database | PostgreSQL | Dev: Postgres.app (native) atau Docker. Produksi: container, data di bind-mount (§10) |
| Auth | Session cookie + tabel `User`/`Session` sendiri (lihat §8) | Bukan library auth pihak ketiga |
| Test | Vitest | `npm test` |
| Parser Excel | `xlsx` (SheetJS) | Dipakai client-side (export) dan server-side (import) |
| Deploy | Docker + docker-compose | Target: ZimaOS (NAS self-hosted, lewat Tailscale) |

**Kenapa dua proses saat development, satu saat produksi:** `npm run dev`
menjalankan Vite (port 3000, hot-reload UI) dan `tsx watch src/server` (API,
port 3001) berbarengan lewat `concurrently`, dengan Vite mem-proxy `/api/*` ke
Express. Saat produksi (`npm start`), Express **juga** men-serve build statis
`dist/` — jadi cuma satu proses, satu port (lihat blok terakhir
`src/server/index.ts`).

**Catatan kebersihan kode yang diketahui:** `src/lib/schemas/*.ts` (skema Zod)
dan referensi ke `src/lib/api/validate.ts` adalah sisa dari arsitektur Next.js
lama — sudah tidak diimpor dari mana pun (validasi input sekarang inline per
route, lihat §7). Aman dihapus kalau ada yang sempat membersihkannya; belum
prioritas karena tidak memengaruhi perilaku aplikasi.

---

## 3. Struktur Direktori

```
src/
├── main.tsx                  # Entry point React (mount ke #root)
├── App.tsx                   # Semua route react-router-dom, lazy-loaded per halaman
├── pages/                    # Satu folder per area fitur
│   ├── DashboardPage.tsx     │ target/    │ points/     │ items/
│   ├── outlets/  │ employees/│ transactions/│ import/   │ settings/
│   ├── dataexplorer/         │ log/       │ cimahi/     │ public/ (Papan Poin, tanpa login)
├── components/                # Komponen UI lintas halaman (chart, tabel, modal, dll)
├── context/                   # AuthContext, ThemeContext, PeriodContext (React Context, bukan Next.js)
├── hooks/                     # Custom hook (mis. usePointsSettings)
├── server/                    # ⭐ Express API — lihat §7 untuk peta lengkap
│   ├── index.ts               # Entry point: setup app, mount semua router, listen
│   ├── middleware.ts          # requireAuth/requireMaster/requireFeature, logActivity, rate limiter
│   ├── uploads.ts             # Konfigurasi multer (Excel, backup JSON)
│   └── routes/                # Satu file per domain — GANJARAN utama refactor modularisasi
└── lib/
    ├── prisma.ts               # Singleton Prisma client + driver adapter
    ├── session.ts              # Buat/verifikasi/cabut session, password env break-glass
    ├── password.ts             # Hash password (scrypt, bawaan Node — bukan bcrypt/argon2)
    ├── permissions.ts          # Resolve FeatureKey yang boleh diakses suatu session
    ├── features.ts             # Daftar FEATURE_KEYS (satu per area sidebar) — lihat §8
    ├── ensureDefaults.ts       # Seed idempoten (lihat §6.4)
    ├── queries/                 # ⭐ Data access layer — satu file per domain, dipakai oleh server/routes
    ├── defaults/                 # Nilai awal (target, mapping, poin) untuk ensureDefaults
    ├── schemas/                  # ⚠️ Tidak dipakai — lihat catatan §2
    └── parse*/import*.ts        # Pipeline import Excel (sales, master item, tartun/server)
```

**Aturan penting:** halaman/komponen React **tidak boleh** memanggil `prisma`
langsung — tidak relevan pula, karena `prisma` hanya ter-import di sisi server
(`src/server/`, `src/lib/queries/*`, `src/lib/*`), bukan di `src/pages` atau
`src/components`. Semua akses data dari UI lewat `fetch("/api/...")`. Ini yang
menjaga logika bisnis tetap satu tempat dan bisa dites tanpa browser.

---

## 4. Model Data

```
ImportBatch ──< Sale >── Item (per-cabang, @@unique([code, branch]))
                 │  │
                 │  └──< Employee ──── PointsExclusion (1:1, opsional)
                 └──< Outlet ──< OutletAlias
                              ├──< TartunDaily
                              └──< ServerDaily

Akun & akses (independen dari data penjualan):
  User ──< Session
   └── CustomRole (peran kustom, daftar FeatureKey yang di-checklist)
  ActivityLog (audit trail semua aksi via logActivity())

Konfigurasi (diedit lewat UI):
  Target · ItemGroupMapping · ItemPoint · ItemPointExclusion
  ItemGroupPointDefault · PointSettings (singleton id=1)
```

### Tabel inti

| Model | Peran |
|---|---|
| `Sale` | Satu baris per line-item transaksi. Cermin baris Excel, tapi menunjuk ke tabel dimensi. Punya `rowHash` unik untuk dedup |
| `ImportBatch` | Riwayat setiap file penjualan yang diunggah. Menghapus batch akan cascade-delete semua `Sale` miliknya. Punya `branch` |
| `Outlet` | Tabel dimensi. Punya `branch` (BANDUNG/CIMAHI) dan `isHidden` — item/outlet/pegawai tersembunyi dikecualikan dari SEMUA agregat analisa, bukan cuma daftar (lihat §6.5) |
| `Item` | **Unik per (`code`, `branch`)**, bukan global — dua cabang punya katalog independen dan bisa memakai kode yang sama untuk produk berbeda. Sumber kebenaran: import "Master Item" per cabang (lihat §5), bukan import penjualan — `isFromSalesImport=true` menandai baris yang ter-buat otomatis karena kode itu belum ada di Master Item saat sale-nya diimpor |
| `Employee` | Tabel dimensi, punya `isHidden` (sama seperti Outlet/Item) |
| `TartunDaily` / `ServerDaily` | Ringkasan harian per outlet dari export terpisah (Tarik Tunai & komisi server). **Upsert per (tanggal, outlet)**, bukan akumulatif — sumbernya memang sudah agregat harian |
| `User` / `Session` | Akun aplikasi (`master`/`admin`) dan sesi login aktifnya. Password di-hash (scrypt), token session hanya disimpan sebagai SHA-256 di DB |
| `CustomRole` | Peran buatan master yang membatasi akun `admin` ke subset `FEATURE_KEYS` |
| `ActivityLog` | Baris per pemanggilan `logActivity()` — siapa melakukan apa, kapan, dari IP mana |

### Index yang sudah terpasang di `Sale`

`[itemId, tanggal]`, `[outletId, tanggal]`, `[employeeId, tanggal]`, `[tanggal]`,
`[noTransaksi]` — menutupi semua pola filter yang dipakai UI. Volume data akan
terus bertambah (arsitektur akumulatif), jadi **setiap query baru yang memfilter
kombinasi kolom lain perlu dicek apakah butuh index tambahan.**

### Enum

- `ImportStatus`: `PROCESSING` | `DONE` | `FAILED` — ⚠️ statusnya `DONE`, bukan `SUCCESS`
- `Branch`: `BANDUNG` | `CIMAHI` — dipakai `Item`, `Outlet`, `ImportBatch`, `Target`
- `TargetScope`: `PERKONTER` (ambang per outlet) | `ALL` (total jaringan)
- `BusinessLine`: `SERVER` | `TARTUN` | `PETSHOP` | `AKSESORIS` | `SP_VOUCHER`
- `ReportCategory`: `PETSHOP` | `AKSESORIS` | `SP_VOUCHER` (subset yang berasal dari POS — dipakai juga untuk memisah leaderboard poin Bandung, lihat §6.6)

---

## 5. Pipeline Import

Ada **dua** pipeline import yang terpisah — jangan tertukar:

### 5a. Import Penjualan (transaksional, akumulatif)

```
File .xls/.xlsx
   ↓ uploadValidation.ts     → cek ekstensi + ukuran (maks 25 MB)
   ↓ parseExcel.ts           → ParsedSaleRow[] + RowError[]
   ↓ previewSalesFile()      → ⭐ pratinjau SEBELUM commit
   ↓ importSalesFile()       → dedup + insert (per cabang)
ImportBatch + Sale[]
```

**Dedup:** `buildRowHash()` membuat sha256 dari **seluruh kolom** baris mentah
(`rowHash`, unique). Efeknya:
- File yang sama diunggah dua kali → semua baris terdeteksi duplikat, nol insert.
- File dengan rentang tanggal tumpang tindih → hanya baris yang benar-benar baru
  yang masuk.

**Alur aman yang wajib dipertahankan:** import selalu lewat pratinjau dulu
(berapa baris baru / duplikat / error), dan penghapusan batch butuh konfirmasi
ketik ulang nama file.

Kalau kode item di baris penjualan belum dikenal untuk cabang itu, `Item` baru
otomatis dibuat dengan `isFromSalesImport=true` — **bukan** sumber kebenaran,
tunggu Master Item menimpanya (lihat di bawah).

### 5b. Import Master Item (katalog per cabang, overwrite)

```
File Master Item .xls/.xlsx (per cabang)
   ↓ parseMasterItems.ts
   ↓ previewMasterItemImport()  → pratinjau: berapa baru / diperbarui
   ↓ importMasterItems()        → upsert per (code, branch); clear isFromSalesImport
```

Ini **satu-satunya** sumber kebenaran untuk nama/kategori item per cabang.
Import penjualan hanya mencocokkan kode terhadap daftar ini, tidak pernah
mendefinisikan ulang nama/kategori sebuah item.

---

## 6. Aturan Domain Kritis

Bagian ini yang paling mudah salah dipahami saat menambah fitur. Baca sebelum
menyentuh perhitungan apa pun.

### 6.1 Sistem Poin — urutan prioritas

Diimplementasi di `computeItemPoints()` ([`src/lib/queries/points.ts`](src/lib/queries/points.ts)),
fungsi murni yang sudah ada unit test-nya.

```
1. ItemPointExclusion cocok?      → 0 poin, berhenti (selalu menang)
2. ItemPoint pattern cocok?       → pakai poin aturan itu
                                    (pola TERPANJANG menang bila ada beberapa)
3. ItemGroupPointDefault ada?     → pakai poin default kategori
4. selain itu                     → 0 poin
```

**Kenapa pattern, bukan `itemId`:** nama item di POS membawa varian warna
("TWS ROBOT AIRBUDS T70E **(PINK)**"), sementara daftar poin pemilik ditulis
ringkas ("TWS Robot Airbuds T70E"). Pencocokan substring case-insensitive
membuat satu aturan mencakup semua varian.

**Pegawai yang dikecualikan** (`PointsExclusion`) difilter di tahap agregasi
`getLeaderboard()` — akun staff/admin/gudang tidak pernah muncul di leaderboard.

### 6.2 Periode "Per Bulan" yang bisa dikustom

`PointSettings.periodStartDay` (1–31) mengatur siklus bulanan.
`computeMonthPeriod(year, month, periodStartDay)` menamai periode berdasarkan
**bulan tempat periode itu DIMULAI**:

| periodStartDay | `computeMonthPeriod(2026, 9, D)` | Arti |
|---|---|---|
| 1 | 1 Sep – 30 Sep | Bulan kalender biasa |
| 29 | **29 Sep – 28 Okt** | Sesuai teks di halaman Pengaturan: "berjalan tanggal 29 sampai 28 **bulan berikutnya**" |

### 6.3 Target Harian diukur terhadap **LABA**, bukan omzet

Ini jebakan paling berbahaya di project ini.

Di [`targetReport.ts`](src/lib/queries/targetReport.ts), kategori yang berasal
dari POS (`PETSHOP`, `AKSESORIS`, `SP_VOUCHER`) mengakumulasi **`Sale.labaRugi`**,
bukan `Sale.subtotal`. Membandingkan target ini dengan omzet adalah
perbandingan besaran yang berbeda — karena itu baseline target di grafik
dashboard **hanya muncul di metrik Laba**, sengaja disembunyikan di metrik
Omzet. Target `SERVER` & `TARTUN` **tidak** ikut baseline dashboard, karena
angkanya datang dari import terpisah (`ServerDaily`/`TartunDaily`), bukan dari
`Sale`.

Laporan Target Harian (`/target`, `/cimahi/target`) sekarang juga menerima
**rentang tanggal**, bukan cuma satu hari — saat itu terjadi, target
(harian, per-baris `Target`) diskalakan `× jumlah hari` di server
(`getTargetReport` → `dayCount`) supaya perbandingan lolos/tidak & persentase
capaian tetap apple-to-apple.

### 6.4 `ensureDefaults()` — seed idempoten

Dipanggil di awal query yang membutuhkannya (dan sekali saat server start di
`src/server/index.ts`), bukan sebagai langkah seed terpisah. Isinya `upsert`,
jadi aman dipanggil berkali-kali dan otomatis mengisi data awal (target,
mapping item-group, alias outlet, daftar poin, poin default kategori) di
database baru — termasuk saat deploy pertama.

### 6.5 Item/Outlet/Pegawai tersembunyi — dikecualikan dari SEMUA agregat

`isHidden` di `Item`/`Outlet`/`Employee` bukan sekadar "sembunyikan dari
daftar". Item tersembunyi dikecualikan dari **setiap** query analisa penjualan
(Dashboard, Performa Outlet, Pegawai, Daftar Transaksi, Analisa Data, Jam
Operasional, Laporan Target Harian) lewat helper bersama
[`EXCLUDE_HIDDEN_ITEMS`](src/lib/queries/_hiddenItems.ts) — **kecuali**:
halaman detail item itu sendiri (`/items?id=`), drill-down transaksi dengan
filter item eksplisit, dan panel "Visibilitas Item" di Settings sendiri (harus
tetap menunjukkan omzet aslinya supaya bisa diputuskan mau disembunyikan atau
tidak). Data penjualannya **tidak dihapus** — menampilkan lagi item itu
langsung memunculkan kembali seluruh angkanya, tanpa perlu impor ulang.

### 6.6 Poin Bandung terpisah per kategori: Aksesoris vs Petshop

Cabang Bandung menjual dua lini produk (aksesoris HP & petshop) dari satu
katalog, jadi leaderboard poinnya dipisah jadi dua menu (`/points` = Aksesoris,
`/points/petshop` = Petshop) dan dua feature key (`points`, `points_petshop`).
Batasnya memakai `ItemGroupMapping` yang sama dipakai Laporan Target Harian
(§6.3) — **bukan** definisi kategori baru. Item dengan `itemGroup` yang belum
dipetakan ke kategori mana pun (atau dipetakan ke `SP_VOUCHER`) tidak muncul di
kedua leaderboard itu, persis seperti sebelum split ini ada. Cimahi belum
dipisah serupa — satu leaderboard gabungan (`/cimahi/points`). Papan Poin
publik (`/papan-poin`, `/papan-poin/petshop`) mengikuti pemisahan yang sama,
tapi **target poin** (harian/mingguan/bulanan) masih satu nilai bersama untuk
kedua kategori, belum dipisah.

---

## 7. API & Peta Modul Server

Semua endpoint di bawah `/api`, satu proses Express (`src/server/index.ts`),
tapi handler-nya dipecah per domain di `src/server/routes/*.ts` — setiap
router file mendaftarkan path `/api/...`-nya sendiri secara lengkap, lalu
di-mount di `index.ts` lewat `app.use(router)` tanpa prefix (jadi tidak ada
prefix yang perlu diselaraskan manual antara nama file dan path). Guard
(`requireAuth`/`requireMaster`/`requireFeature`), `logActivity`, rate limiter,
dan `cacheBriefly` semuanya diimpor dari [`middleware.ts`](src/server/middleware.ts) —
**bukan** didefinisikan ulang per router.

| Router file | Domain | Endpoint utama | Guard |
|---|---|---|---|
| `routes/auth.ts` | Login/logout/sesi sendiri | `/api/auth/*` | publik (login), `requireAuth` (ganti password) |
| `routes/accounts.ts` | Akun & sesi aktif (kelola akun lain) | `/api/users/*`, `/api/sessions/*` | `requireMaster` |
| `routes/roles.ts` | Peran kustom | `/api/roles/*` | `requireMaster` |
| `routes/backup.ts` | Backup/restore data & pengaturan | `/api/backup/*` | `requireMaster` |
| `routes/dashboard.ts` | Ringkasan eksekutif | `/api/status`, `/api/dashboard` | `requireAuth` / `requireFeature` |
| `routes/outlets.ts` | Performa & visibilitas outlet | `/api/outlets*` | campuran |
| `routes/employees.ts` | Performa & visibilitas pegawai | `/api/employees*` | campuran |
| `routes/items.ts` | Katalog item, pencarian, visibilitas, kategori | `/api/items*` | campuran |
| `routes/sales.ts` | Daftar transaksi + export CSV | `/api/sales*` | `requireFeature("transactions")` |
| `routes/dataExplorer.ts` | Analisa Data (gabungan 3 sumber) + hapus massal | `/api/data-explorer*` | `requireFeature` / `requireMaster` |
| `routes/target.ts` | Laporan Target Harian, nominal target, Jam Operasional | `/api/target*`, `/api/hourly` | `requireFeature` / `requireMaster` |
| `routes/points.ts` | Leaderboard internal, rincian pegawai, export Excel, aturan poin | `/api/points/*` (kecuali `/public/`) | `requireFeature(pointsFeature)` / `requireMaster` |
| `routes/publicPoints.ts` | Papan Poin publik (tanpa login) | `/api/public/points/*` | **tanpa auth** — hanya `publicPointsLimiter` |
| `routes/mappings.ts` | Mapping item-group→kategori, alias outlet | `/api/mappings/*` | `requireMaster` |
| `routes/imports.ts` | Import penjualan/Tartun/Server + riwayatnya | `/api/import*`, `/api/imports*`, `/api/daily-imports/*` | `requireFeature("import")` |
| `routes/masterItems.ts` | Import Master Item per cabang | `/api/settings/master-items/*` | `requireMaster` |
| `routes/activityLog.ts` | Log aktivitas (audit trail) | `/api/activity-log` | `requireFeature("activity_log")` |

**Cara menambah endpoint baru:** cari domain yang paling cocok di tabel di
atas dan tambahkan ke router-nya. Domain benar-benar baru → buat
`routes/<domain>.ts` baru (contoh mana pun di atas sebagai template — import
guard dari `../middleware`, `upload`/`uploadBackup` dari `../uploads` kalau
perlu terima file), lalu daftarkan satu baris `app.use(...)` di
`src/server/index.ts`.

**Konvensi tiap handler:**
```ts
router.get("/api/domain/:id", requireFeature("domain"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "ID tidak valid" });
    const data = await someQueryFn(id);
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
```
- Validasi input inline (bukan skema Zod terpusat — lihat catatan §2 soal
  `src/lib/schemas/`).
- Pesan error ditulis dalam Bahasa Indonesia (langsung tampil ke pengguna).
- Mutasi yang berarti (buat/ubah/hapus data, toggle visibilitas, dst) memanggil
  `logActivity(req, "KODE_AKSI", "detail singkat")` sebelum `return`.

---

## 8. Autentikasi & Otorisasi

**Bukan** satu password bersama — ada tabel `User` dengan role `master` (akses
penuh, tidak bisa dibatasi) atau `admin` (bisa dibatasi lewat `CustomRole`).

```
Browser ──cookie sesi──> requireAuth / requireMaster / requireFeature(key)
                          (src/server/middleware.ts, per-route, bukan gerbang global)
                          ├─ tidak ada sesi valid     → 401 JSON
                          ├─ requireMaster tapi role≠master → 403 JSON
                          └─ requireFeature tapi fitur tidak diizinkan → 403 JSON
```

- **Password akun**: di-hash dengan `scrypt` (bawaan Node, memory-hard) di
  [`password.ts`](src/lib/password.ts) — bukan bcrypt/argon2 (menghindari
  native build step di image Docker).
- **Session**: token acak dikirim ke browser (`httpOnly`, `sameSite=lax`,
  `secure` di produksi); yang disimpan di tabel `Session` cuma SHA-256-nya —
  kebocoran database saja tidak bisa dipakai untuk login ulang. `revokedAt`
  di baris `Session` itulah yang membuat fitur "kick" sesi bisa jalan.
- **Break-glass**: `MASTER_PASSWORD`/`ADMIN_PASSWORD`/`APP_PASSWORD` (legacy)
  di `.env` — dipakai kalau username tidak cocok akun mana pun di database,
  supaya aplikasi tidak pernah benar-benar terkunci total. Lihat
  [`verifyEnvPassword`](src/lib/session.ts).
- **Otorisasi granular**: `FEATURE_KEYS` di [`features.ts`](src/lib/features.ts) —
  satu key per area sidebar (`dashboard`, `points`, `points_petshop`,
  `target_cimahi`, dst). `master` selalu lolos semua; `admin` tanpa
  `CustomRole` juga lolos semua (kompatibel ke belakang); `admin` dengan
  `CustomRole` dibatasi ke daftar key yang di-checklist master di Settings →
  Manajemen Peran. `requireFeature` menerima key tetap atau fungsi dari
  request (mis. baca `?branch=`/`?category=` untuk membedakan Bandung vs
  Cimahi, atau Aksesoris vs Petshop — lihat §6.6).
- **Guard di sisi client** (`AppLayout.tsx`, `PATH_FEATURES`) mengarahkan
  pengguna menjauh dari halaman yang tidak diizinkan — ini kenyamanan UX saja,
  **bukan** lapisan keamanan; penegakan sesungguhnya ada di `requireFeature`
  sisi server.

⚠️ **Wajib ganti `SESSION_SECRET`/`MASTER_PASSWORD` di `.env` sebelum deploy
keluar jaringan lokal.**

---

## 9. Testing

`npm test` (Vitest) — fokus pada **fungsi murni** yang tidak butuh database:

| File | Yang dijaga |
|---|---|
| `queries/points.test.ts` | Prioritas resolusi poin & matematika periode custom |
| `parseSalesFilterParams.test.ts` | Parsing filter halaman Daftar Transaksi |
| `parseMasterItems.test.ts` | Parsing file Master Item per cabang |
| `hash.test.ts` | Determinisme & keunikan kunci dedup import |
| `format.test.ts` | Format Rupiah/tanggal |
| `dateDefaults.test.ts` | Rollover tanggal lintas bulan/tahun |

**Pola yang dipakai:** pisahkan algoritma dari I/O. Contohnya
`resolveItemPointsForIds()` mengambil data dari Prisma lalu memanggil
`computeItemPoints()` yang murni — yang murni itulah yang dites. Ikuti pola
ini untuk logika baru: kalau sebuah fungsi query punya percabangan aturan
bisnis yang tidak sepele, pertimbangkan memisah bagian murninya supaya bisa
dites tanpa database.

---

## 10. Deployment

```bash
cp .env.example .env     # WAJIB: isi APP_PASSWORD/MASTER_PASSWORD & SESSION_SECRET
docker-compose up -d --build
```

- `docker-entrypoint.sh` menjalankan `prisma migrate deploy` sebelum server start.
- `ensureDefaults()` mengisi data konfigurasi awal saat request pertama.
- Migrasi: **selalu** `prisma migrate deploy`, jangan `migrate dev` di produksi
  (butuh reset interaktif saat mendeteksi drift). Migration SQL yang menyentuh
  data produksi ditulis idempoten (`ADD COLUMN IF NOT EXISTS`, dst) — lihat
  migration mana pun di `prisma/migrations/` sebagai contoh.
- **Data Postgres di-bind-mount** (`./pgdata:/var/lib/postgresql/data`), bukan
  Docker named volume — supaya datanya terlihat sebagai folder biasa di host
  (bisa di-`ls`, disalin, di-backup langsung), tidak tersembunyi di dalam
  data-root Docker yang bisa ikut terhapus tanpa disadari oleh operasi
  Docker-level lain. Detail lengkap + cara migrasi dari deployment lama ada di
  [README.md](README.md#penyimpanan-data--bind-mount-bukan-docker-volume).
- **Jangan pernah** `docker-compose down -v` — flag `-v` menghapus juga bind-mount
  data (sama mematikannya untuk bind-mount seperti untuk named volume).
- Backup terjadwal: `scripts/backup-db.sh` (cron di host, bukan di dalam
  container) — lihat README untuk contoh crontab.

---

## 11. Batasan Saat Ini (sadar, bukan lupa)

| Tidak ada | Alasan |
|---|---|
| Data stok / alert kehabisan barang | Tidak ada tabel stok; export POS tidak memuatnya |
| Perbandingan Year-over-Year | Riwayat data belum cukup panjang |
| Global search (Ctrl+K) | Belum diimplementasi — sengaja tidak dipasang kotak search palsu |
| Target poin terpisah per kategori (Aksesoris/Petshop) | Baru leaderboard-nya yang dipisah (§6.6); `PointSettings` masih satu nilai bersama |
| Split poin Aksesoris/Petshop untuk Cimahi | Cimahi masih satu leaderboard gabungan; belum diminta |

**Utang teknis yang diketahui:**
- `src/lib/schemas/*.ts` dan referensi `src/lib/api/validate.ts` — sisa
  arsitektur Next.js lama, sudah tidak dipakai (lihat §2).
- Beberapa komponen client lama masih memicu warning lint
  `react-hooks/set-state-in-effect` (pre-existing, tidak memblokir build).

---

## 12. Menambah Fitur Baru — Urutan Kerja

1. **Model data** (kalau perlu) → ubah `prisma/schema.prisma`, tulis migrasi
   idempoten (`ADD COLUMN IF NOT EXISTS` dst — lihat §10), jalankan
   `npx prisma migrate dev` di lokal.
2. **Query** → tambah fungsi di `src/lib/queries/<domain>.ts`. Pisahkan
   algoritma murni dari pengambilan data (§9) kalau ada logika bisnis yang
   pantas dites.
3. **Test** → tulis test untuk bagian murninya bila relevan.
4. **API route** → tambahkan ke `src/server/routes/<domain>.ts` yang sudah
   ada, atau buat baru + daftarkan di `src/server/index.ts` (lihat §7). Tipis
   saja: validasi input → panggil query → balikan JSON. Mutasi yang berarti
   memanggil `logActivity(...)`.
5. **UI** → halaman/komponen di `src/pages/` atau `src/components/`, `fetch()`
   ke endpoint barunya. Untuk halaman yang sering dikunjungi, pertimbangkan
   React Query (sudah dipakai di beberapa halaman tersibuk) alih-alih
   `useEffect` + `fetch` manual.
6. **Verifikasi di browser** (`npm run dev`), jangan hanya percaya
   `tsc`/`eslint`/`vitest` hijau — terutama untuk perubahan yang menyentuh
   angka finansial atau logika otorisasi.

### Jebakan yang sudah pernah menggigit

- **Tailwind v4 & cascade layer**: CSS di luar `@layer` **mengalahkan** semua
  utility Tailwind (yang hidup di `@layer utilities`). Aturan global seperti
  `* { border-color: … }` wajib ditaruh di dalam `@layer base`, kalau tidak
  ia diam-diam membatalkan `border-transparent` di seluruh aplikasi.
- **Prisma 7**: wajib driver adapter. `migrate dev` akan minta reset destruktif
  bila mendeteksi drift — pakai `migrate diff` + migrasi manual + `migrate deploy`
  di produksi, jangan pernah `migrate dev` di sana.
- **Recharts v3**: set `isAnimationActive={false}`; animasi bisa membuat chart
  ter-render salah.
- **Angka finansial**: jangan pernah dipotong (`truncate`) di UI — kecilkan
  ukuran font agar tetap terbaca utuh.
- **`Item.code` unik per cabang, bukan global** (§4) — query/import yang lupa
  menyertakan `branch` di filter/where bisa salah mencampur item dua cabang
  yang kebetulan berkode sama. Insiden nyata pernah terjadi sebelum
  `@@unique([code, branch])` ditambahkan; skrip perbaikannya ada di
  `scripts/backfill-item-branch.ts` sebagai referensi pola "dry-run dulu,
  `--apply` belakangan" untuk skrip data production lainnya.
- **`isHidden` (§6.5) dan filter kategori poin (§6.6)** gampang terlewat kalau
  menambah query agregat penjualan baru — cek apakah query serupa yang sudah
  ada memakai `EXCLUDE_HIDDEN_ITEMS`/`getItemGroupsForCategory`, dan ikuti
  polanya kalau relevan.
