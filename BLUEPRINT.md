# AnalisaBEe — Blueprint Teknis

Dokumen acuan arsitektur, model data, dan aturan domain untuk **AnalisaBEe** —
aplikasi analisa data penjualan dari export Excel POS milik CV. Asya Bisnis
Indonesia (jaringan 42 outlet konter HP & petshop, area Bandung).

Dokumen pendamping:
- [`design.md`](design.md) — design system visual (token warna, tipografi, komponen).
- [`AGENTS.md`](AGENTS.md) — catatan versi Next.js yang dipakai project ini.
- [`README.md`](README.md) — cara menjalankan project.

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
   lewat UI, bukan konstanta di kode.
4. **Jangan tampilkan angka yang tidak punya data pendukung.** Kalau sumber
   datanya tidak ada, fiturnya tidak dibuat — bukan diisi placeholder.

---

## 2. Stack

| Lapisan | Teknologi | Catatan |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack) | ⚠️ `middleware.ts` sudah deprecated → dipakai `proxy.ts` |
| UI | React 19, Tailwind v4, Recharts, next-themes | Tailwind v4 pakai `@theme inline`, bukan `tailwind.config.js` |
| ORM | Prisma 7 + `@prisma/adapter-pg` | Wajib driver adapter; cara lama (connection string langsung) sudah tidak berlaku |
| Database | PostgreSQL 18 | Dev: Postgres.app (native, hemat RAM). Produksi: container |
| Validasi | Zod v4 | Terpusat di `src/lib/schemas/` |
| Test | Vitest | `npm test` |
| Parser Excel | `xlsx` (SheetJS) | |
| Deploy | Docker + docker-compose | Target: ZimaOS (NAS self-hosted) |

**Kenapa Postgres.app untuk dev:** mesin dev 8GB RAM; menjalankan Docker Desktop
hanya untuk database memakan RAM yang tidak perlu. Docker tetap dipakai untuk
produksi supaya environment-nya reproducible.

---

## 3. Struktur Direktori

```
src/
├── proxy.ts                  # Gerbang auth — jalan sebelum semua route
├── app/
│   ├── layout.tsx            # Root: html/body, font, ThemeProvider
│   ├── globals.css           # Design token (lihat design.md)
│   ├── login/                # Halaman login (di luar shell aplikasi)
│   ├── (app)/                # Route group: semua halaman ber-Sidebar+Topbar
│   │   ├── layout.tsx        # Shell aplikasi
│   │   ├── dashboard/        │ items/    │ outlets/   │ employees/
│   │   ├── transactions/     │ target/   │ points/    │ import/
│   └── api/                  # Route handler (lihat §7)
├── components/               # Komponen UI dipakai lintas halaman
└── lib/
    ├── prisma.ts             # Singleton Prisma client + driver adapter
    ├── session.ts            # Enkripsi/verifikasi session JWT
    ├── ensureDefaults.ts     # Seed idempoten (lihat §6)
    ├── queries/              # ⭐ Data access layer — satu file per domain
    ├── schemas/              # Skema Zod untuk validasi input API
    ├── api/validate.ts       # Helper parse+validasi body request
    ├── defaults/             # Nilai awal (target, mapping, poin)
    └── parse*/import*.ts     # Pipeline import Excel
```

**Aturan penting:** komponen dan halaman **tidak boleh** memanggil `prisma`
langsung. Semua akses data lewat `src/lib/queries/*`. Ini yang menjaga logika
bisnis tetap bisa dites dan tidak tersebar.

---

## 4. Model Data

```
ImportBatch ──< Sale >── Item
                 │  │
                 │  └──< Employee ──── PointsExclusion (1:1, opsional)
                 └──< Outlet ──< OutletAlias
                              ├──< TartunDaily
                              └──< ServerDaily

Konfigurasi (diedit lewat UI):
  Target · ItemGroupMapping · ItemPoint · ItemPointExclusion
  ItemGroupPointDefault · PointSettings (singleton id=1)
```

### Tabel inti

| Model | Peran |
|---|---|
| `Sale` | Satu baris per line-item transaksi. Cermin baris Excel, tapi menunjuk ke tabel dimensi. Punya `rowHash` unik untuk dedup |
| `ImportBatch` | Riwayat setiap file yang diunggah. Menghapus batch akan cascade-delete semua `Sale` miliknya |
| `Outlet` / `Item` / `Employee` | Tabel dimensi, dibuat otomatis saat import menemukan nama baru |
| `TartunDaily` / `ServerDaily` | Ringkasan harian per outlet dari export terpisah (Tarik Tunai & komisi server). **Upsert per (tanggal, outlet)**, bukan akumulatif — sumbernya memang sudah agregat harian, tidak ada granularitas line-item yang perlu dijaga |

### Index yang sudah terpasang di `Sale`

`[itemId, tanggal]`, `[outletId, tanggal]`, `[employeeId, tanggal]`, `[tanggal]`,
`[noTransaksi]` — menutupi semua pola filter yang dipakai UI. Volume data akan
terus bertambah (arsitektur akumulatif), jadi **setiap query baru yang memfilter
kombinasi kolom lain perlu dicek apakah butuh index tambahan.**

### Enum

- `ImportStatus`: `PROCESSING` | `DONE` | `FAILED` — ⚠️ statusnya `DONE`, bukan `SUCCESS`
- `TargetScope`: `PERKONTER` (ambang per outlet) | `ALL` (total jaringan)
- `BusinessLine`: `SERVER` | `TARTUN` | `PETSHOP` | `AKSESORIS` | `SP_VOUCHER`
- `ReportCategory`: `PETSHOP` | `AKSESORIS` | `SP_VOUCHER` (subset yang berasal dari POS)

---

## 5. Pipeline Import

```
File .xls/.xlsx
   ↓ uploadValidation.ts     → cek ekstensi + ukuran (maks 25 MB)
   ↓ parseExcel.ts           → ParsedSaleRow[] + RowError[]
   ↓ previewSalesFile()      → ⭐ pratinjau SEBELUM commit
   ↓ importSalesFile()       → dedup + insert
ImportBatch + Sale[]
```

**Dedup:** `buildRowHash()` membuat sha256 dari **seluruh kolom** baris mentah
(`rowHash`, unique). Efeknya:
- File yang sama diunggah dua kali → semua baris terdeteksi duplikat, nol insert.
- File dengan rentang tanggal tumpang tindih → hanya baris yang benar-benar baru
  yang masuk.
- Dua penjualan berbeda yang kebetulan mirip tetap punya hash berbeda karena
  setiap kolom ikut di-hash dengan separator.

**Alur aman yang wajib dipertahankan:** import selalu lewat pratinjau dulu
(berapa baris baru / duplikat / error), dan penghapusan batch butuh konfirmasi
ketik ulang nama file.

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

⚠️ Ini pernah salah didokumentasikan (komentar kode sempat menyebut 29 Ags – 28 Sep).
Perilaku yang benar dan sudah ada test-nya adalah tabel di atas.

### 6.3 Target Harian diukur terhadap **LABA**, bukan omzet

Ini jebakan paling berbahaya di project ini.

Di [`targetReport.ts`](src/lib/queries/targetReport.ts), kategori yang berasal
dari POS (`PETSHOP`, `AKSESORIS`, `SP_VOUCHER`) mengakumulasi **`Sale.labaRugi`**,
bukan `Sale.subtotal`. Jadi:

- Target `ALL` untuk 3 kategori POS = **Rp 6.590.000/hari** → ini target **laba**.
- Membandingkannya dengan omzet (Rp 53,8 Jt) adalah perbandingan besaran berbeda.
- Karena itu baseline target di grafik dashboard **hanya muncul di metrik Laba**,
  dan sengaja disembunyikan di metrik Omzet.
- Target `SERVER` & `TARTUN` **tidak** ikut baseline dashboard, karena angkanya
  datang dari import terpisah (`ServerDaily`/`TartunDaily`), bukan dari `Sale`.

### 6.4 `ensureDefaults()` — seed idempoten

Dipanggil di awal query yang membutuhkannya, bukan sebagai langkah seed terpisah.
Isinya `upsert`, jadi aman dipanggil berkali-kali dan otomatis mengisi data awal
(target, mapping item-group, alias outlet, daftar poin, poin default kategori)
di database baru — termasuk saat deploy pertama.

---

## 7. API

Semua di bawah `/api`, semuanya dijaga `proxy.ts`.

| Kelompok | Endpoint |
|---|---|
| Auth | `POST /auth/logout` |
| Analitik | `GET /dashboard`, `GET /hourly`, `GET /sales`, `GET /sales/export` |
| Dimensi | `GET /items`, `/items/[id]`, `/outlets`, `/outlets/[id]`, `/employees`, `/employees/[id]` |
| Import | `POST /import`, `/import/preview`, `/import/tartun`, `/import/server`; `GET /imports`; `DELETE /imports/[id]` |
| Mapping | `GET/POST /mappings/item-group`, `/mappings/outlet-alias`; `DELETE .../[id]` |
| Target | `GET/PUT /target`, `GET /target/report` |
| Poin | `GET/POST /points/items`, `/points/group-defaults`, `/points/item-exclusions`, `/points/excluded-employees` (+ `DELETE .../[id]`); `GET/PUT /points/settings`; `GET /points/leaderboard`, `/points/employee/[id]` |

### Konvensi menulis route baru

```ts
export async function POST(request: Request) {
  const parsed = await parseJsonBody(request, mySchema);   // src/lib/api/validate.ts
  if ("error" in parsed) return parsed.error;              // 400 + pesan Indonesia
  const { field } = parsed.data;
  // ...
}
```

- Body JSON **selalu** divalidasi lewat skema Zod di `src/lib/schemas/`.
- Param `[id]` divalidasi dengan `parseIntId()` + `invalidIdResponse()`.
- Pesan error ditulis dalam Bahasa Indonesia (langsung tampil ke pengguna).

---

## 8. Autentikasi

Model: **satu password bersama** untuk seluruh website (aplikasi internal, bukan
multi-tenant).

```
Browser ──> proxy.ts ──> cookie sesi ada & valid?
                          ├─ ya                  → lanjut
                          ├─ tidak, path /api/*  → 401 JSON
                          └─ tidak, halaman      → redirect /login?from=...
```

- `APP_PASSWORD` — password gate. Dibandingkan dengan `timingSafeEqual`.
- `SESSION_SECRET` — kunci penandatangan JWT (`jose`, HS256, umur 30 hari).
- Cookie: `httpOnly`, `sameSite=lax`, `secure` di produksi.
- `proxy.ts` hanya membaca cookie (tanpa query database) karena jalan di setiap request.

⚠️ **Wajib diganti sebelum deploy keluar jaringan lokal.** Nilai di `.env` saat ini
masih default development.

---

## 9. Testing

`npm test` (Vitest) — 30 test, fokus pada **fungsi murni** yang tidak butuh database:

| File | Yang dijaga |
|---|---|
| `queries/points.test.ts` | Prioritas resolusi poin & matematika periode custom |
| `parseSalesFilterParams.test.ts` | Parsing filter halaman Data Penjualan |
| `hash.test.ts` | Determinisme & keunikan kunci dedup import |
| `format.test.ts` | Format Rupiah/tanggal |
| `dateDefaults.test.ts` | Rollover tanggal lintas bulan/tahun |

**Pola yang dipakai:** pisahkan algoritma dari I/O. Contohnya `resolveItemPoints()`
mengambil data dari Prisma lalu memanggil `computeItemPoints()` yang murni —
yang murni itulah yang dites. Ikuti pola ini untuk logika baru.

---

## 10. Deployment

```bash
cp .env.example .env     # WAJIB: isi APP_PASSWORD & SESSION_SECRET
docker compose up -d
```

- `docker-entrypoint.sh` menjalankan `prisma migrate deploy` sebelum server start.
- `ensureDefaults()` mengisi data konfigurasi awal saat request pertama.
- Migrasi: **selalu** `prisma migrate deploy`, jangan `migrate dev` di produksi
  (butuh reset interaktif saat mendeteksi drift).

---

## 11. Batasan Saat Ini (sadar, bukan lupa)

| Tidak ada | Alasan |
|---|---|
| Data stok / alert kehabisan barang | Tidak ada tabel stok; export POS tidak memuatnya |
| Cluster/wilayah outlet | `Outlet` tidak punya field wilayah; 42 outlet semuanya area Bandung |
| Perbandingan Year-over-Year | Riwayat data belum cukup panjang |
| Multi-user / role | Sengaja: satu password bersama sudah cukup untuk pemakaian internal |
| Global search (Ctrl+K) | Belum diimplementasi — sengaja tidak dipasang kotak search palsu |

**Utang teknis yang diketahui:** 19 error lint `react-hooks/set-state-in-effect`
di komponen client lama (pre-existing, tidak memblokir build).

---

## 12. Menambah Fitur Baru — Urutan Kerja

1. **Model data** → ubah `prisma/schema.prisma`, buat migrasi.
2. **Query** → tambah fungsi di `src/lib/queries/<domain>.ts`. Pisahkan
   algoritma murni dari pengambilan data.
3. **Test** → tulis test untuk bagian murninya.
4. **Skema validasi** → `src/lib/schemas/<domain>.ts` bila ada input.
5. **API route** → tipis saja: validasi → panggil query → balikan JSON.
6. **UI** → Server Component untuk ambil data; Client Component untuk interaksi.
   ⚠️ Fungsi (mis. kolom tabel dengan renderer) **tidak bisa** dioper dari Server
   ke Client Component — definisikan di dalam Client Component-nya.
7. **Verifikasi di browser**, jangan hanya percaya build hijau.

### Jebakan yang sudah pernah menggigit

- **Next.js 16**: `middleware.ts` → `proxy.ts`. Baca `node_modules/next/dist/docs/`
  sebelum memakai API framework yang belum pernah dipakai di project ini.
- **Tailwind v4 & cascade layer**: CSS di luar `@layer` **mengalahkan** semua
  utility Tailwind (yang hidup di `@layer utilities`). Aturan global seperti
  `* { border-color: … }` wajib ditaruh di dalam `@layer base`, kalau tidak
  ia diam-diam membatalkan `border-transparent` di seluruh aplikasi.
- **Prisma 7**: wajib driver adapter. `migrate dev` akan minta reset destruktif
  bila mendeteksi drift — pakai `migrate diff` + migrasi manual + `migrate deploy`.
- **Recharts v3**: set `isAnimationActive={false}`; animasi bisa membuat chart
  ter-render salah.
- **Angka finansial**: jangan pernah dipotong (`truncate`) di UI — kecilkan
  ukuran font agar tetap terbaca utuh.
