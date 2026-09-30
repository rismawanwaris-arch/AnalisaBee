# AnalisaBEe — Katalog Fitur

Daftar setiap halaman/fitur yang ada di aplikasi: apa fungsinya, siapa yang
boleh mengaksesnya, dan file mana yang terkait — supaya pengembangan lanjutan
dan pembacaan ulang di kemudian hari tidak perlu membongkar seluruh kode dari
nol.

Dokumen pendamping:
- [`BLUEPRINT.md`](BLUEPRINT.md) — arsitektur, model data, dan aturan domain
  (baca ini kalau pertanyaannya "bagaimana cara kerjanya", bukan "fitur ini
  ngapain").
- [`README.md`](README.md) — cara menjalankan project & deploy.

**Cara baca:** tiap fitur punya baris **Akses** (feature key dari
[`features.ts`](src/lib/features.ts), atau `master` kalau memang dibatasi
khusus master) dan baris **File** (halaman React → query data → route API,
urutan dari yang paling sering disentuh saat menambah fitur serupa). Nomor
bagian domain aturan (§6.x dst) merujuk ke `BLUEPRINT.md`.

---

## Login & Sesi

### Login
Halaman `/login` — masuk pakai akun (`username`+password) atau password
break-glass dari `.env` (lihat BLUEPRINT §8). Satu pesan error untuk semua
kegagalan (tidak membocorkan username mana yang valid).
**Akses:** publik. **File:** [`LoginPage.tsx`](src/pages/LoginPage.tsx) →
[`routes/auth.ts`](src/server/routes/auth.ts).

---

## Cabang Bandung

### Dashboard
`/dashboard` — ringkasan eksekutif: total omzet/laba/qty per rentang tanggal,
tren grafik, top item & top outlet. Baseline target di grafik **hanya** muncul
di metrik Laba (lihat §6.3 — target diukur terhadap laba, bukan omzet).
**Akses:** `dashboard`. **File:** [`DashboardPage.tsx`](src/pages/DashboardPage.tsx) →
[`queries/dashboard.ts`](src/lib/queries/dashboard.ts) →
[`routes/dashboard.ts`](src/server/routes/dashboard.ts).

### Target Harian → Laporan Harian
`/target` — status lolos/tidak target harian per outlet untuk **5 lini bisnis**
(Server, Tarik Tunai, Petshop, Aksesoris, SP/Voucher), termasuk badge
persentase capaian jaringan. Menerima rentang tanggal (bukan cuma satu hari);
target harian di-skalakan `× jumlah hari` di server supaya perbandingannya
tetap apple-to-apple (§6.3). Server/Tartun sumbernya `ServerDaily`/`TartunDaily`
(import terpisah), tiga lini POS lainnya dari `Sale.labaRugi`.
**Akses:** `target_bandung`. **File:** [`TargetReportPage.tsx`](src/pages/target/TargetReportPage.tsx) →
[`queries/targetReport.ts`](src/lib/queries/targetReport.ts) →
[`routes/target.ts`](src/server/routes/target.ts) (`GET /api/target/report`).

### Target Harian → Analitik Eksekutif
`/target/analitik` — breakdown visual (bar/pie/scatter) dari data laporan
harian yang sama, per outlet dan per lini bisnis — untuk melihat pola, bukan
cuma status lolos/tidak.
**Akses:** `target_bandung`. **File:** [`AnalitikPage.tsx`](src/pages/target/AnalitikPage.tsx),
data sama dengan Laporan Harian di atas.

### Target Harian → Jam Operasional
`/target/jam-operasional` — kurva jam sibuk transaksi (jam berapa omzet/qty
paling tinggi), dipakai untuk keputusan jadwal shift pegawai.
**Akses:** `target_bandung`. **File:** [`JamOperasionalPage.tsx`](src/pages/target/JamOperasionalPage.tsx) →
[`queries/hourly.ts`](src/lib/queries/hourly.ts) →
[`routes/target.ts`](src/server/routes/target.ts) (`GET /api/hourly`).

### Poin Aksesoris / Poin Petshop / Poin SP-Voucher
`/points` (Aksesoris), `/points/petshop` (Petshop), dan `/points/sp`
(SP/Voucher) — leaderboard poin pegawai bulanan/mingguan/harian (periode
custom, lihat §6.2), plus rincian per pegawai (item apa saja yang
menyumbang poin). Cabang Bandung dipisah tiga menu karena menjual tiga lini
produk dari satu katalog (§6.6) — batasnya memakai `ItemGroupMapping` yang
sama dipakai Target Harian, bukan definisi kategori baru. Urutan resolusi
poin per item: `ItemPointExclusion` → `ItemPoint` (pattern terpanjang
menang) → `ItemGroupPointDefault` → 0 (§6.1).
**Akses:** `points` (Aksesoris) / `points_petshop` (Petshop) / `points_sp`
(SP/Voucher). **File:**
[`PointsLeaderboardPage.tsx`](src/pages/points/PointsLeaderboardPage.tsx) →
[`queries/points.ts`](src/lib/queries/points.ts) →
[`routes/points.ts`](src/server/routes/points.ts).

---

## Cabang Cimahi

Struktur sama persis dengan Bandung (Dashboard, Target Harian, Analitik,
Jam Operasional), kecuali:
- **Poin Penjualan** (`/cimahi/points`) — belum dipisah Aksesoris/Petshop
  seperti Bandung, masih satu leaderboard gabungan (§6.6, "Batasan Saat Ini").
- Semua route Cimahi memakai komponen **yang sama** dengan Bandung, dibedakan
  lewat prop `branch="CIMAHI"` — lihat `App.tsx` untuk pemetaannya. Jangan
  buat halaman/komponen duplikat untuk Cimahi; tambahkan prop `branch` ke yang
  sudah ada.
**Akses:** `dashboard_cimahi` / `target_cimahi` / `points_cimahi`. **File:**
sama dengan Bandung di atas, dipanggil ulang lewat [`CimahiLayout.tsx`](src/pages/cimahi/CimahiLayout.tsx).

---

## Dimensi Analisis

Halaman-halaman berikut **tidak** dipisah per cabang di sidebar — filter
cabang/outlet ada di dalam halamannya sendiri, dan semuanya otomatis
mengecualikan item/outlet/pegawai yang `isHidden` dari setiap angka agregat
kecuali sedang membuka detail item/outlet itu sendiri (§6.5).

### Item & SKU
`/items` — cari & jelajah satu item: total qty/omzet/laba, sebaran penjualan
per outlet dan per tanggal, riwayat transaksi. Titik masuk drill-down dari
banyak halaman lain (klik nama item di Dashboard/Analisa Data, dst).
**Akses:** `items`. **File:** [`ItemsPage.tsx`](src/pages/items/ItemsPage.tsx) →
[`queries/items.ts`](src/lib/queries/items.ts) →
[`routes/items.ts`](src/server/routes/items.ts).

### Kategori Item
`/items/categories` — performa penjualan dikelompokkan per kategori produk
(`ReportCategory`: Petshop/Aksesoris/SP-Voucher), untuk melihat item terlaris
per kategori tanpa harus buka satu-satu.
**Akses:** `item_categories`. **File:** [`ItemsByCategoryPage.tsx`](src/pages/items/ItemsByCategoryPage.tsx) →
`routes/items.ts` (`GET /api/items/by-category`).

### Performa Outlet
`/outlets` — matriks komparasi omzet/laba/qty/transaksi semua outlet
sekaligus, dengan filter tanggal, item, kategori, merk, dan karyawan. Klik
satu outlet → halaman detail (`/outlets/:id`) dengan tren & rincian per item.
**Akses:** `outlets`. **File:** [`OutletsPage.tsx`](src/pages/outlets/OutletsPage.tsx) /
[`OutletDetailPage.tsx`](src/pages/outlets/OutletDetailPage.tsx) →
[`queries/outlets.ts`](src/lib/queries/outlets.ts) →
[`routes/outlets.ts`](src/server/routes/outlets.ts).

### Pegawai & Staff
`/employees` — daftar & performa penjualan per pegawai lintas outlet. Klik
satu pegawai → halaman detail (`/employees/:id`) dengan riwayat & rincian
item yang dijual.
**Akses:** `employees`. **File:** [`EmployeesPage.tsx`](src/pages/employees/EmployeesPage.tsx) /
[`EmployeeDetailPage.tsx`](src/pages/employees/EmployeeDetailPage.tsx) →
[`queries/employees.ts`](src/lib/queries/employees.ts) →
[`routes/employees.ts`](src/server/routes/employees.ts).

### Daftar Transaksi
`/transactions` — audit baris-per-baris seluruh `Sale` (bukan agregat):
filter tanggal, outlet, item, pegawai, no. transaksi, rentang jam/qty/nominal;
export CSV. Kolom **Jenis** membedakan baris penjualan biasa dari baris retur
(lihat bagian Retur Penjualan di bawah) — noTransaksi retur berformat `SE...`,
qty/omzet/laba selalu negatif.
**Akses:** `transactions`. **File:** [`TransactionsPage.tsx`](src/pages/transactions/TransactionsPage.tsx) →
[`queries/sales.ts`](src/lib/queries/sales.ts) →
[`routes/sales.ts`](src/server/routes/sales.ts) (`GET /api/sales`, `/api/sales/export`).

---

## Manajemen Data & Sistem

### Import & Batch
`/import` — pusat semua import data, dengan beberapa alur berbeda di satu
halaman:

- **Import Penjualan** — upload file `.xls`/`.xlsx` per cabang, lewat alur
  pratinjau dulu (baru/duplikat/error) sebelum commit (§5a). Dedup pakai
  `rowHash` (sha256 seluruh kolom), jadi file dengan rentang tanggal
  tumpang-tindih aman diunggah ulang.
- **Data Tarik Tunai & Komisi Server** — upload/tempel-teks ringkasan harian
  per outlet; **upsert per (tanggal, outlet)**, bukan akumulatif (beda dengan
  import penjualan/retur), karena sumbernya memang sudah agregat harian.
- **Retur Penjualan** — upload harian, mirip pola import penjualan (bukan
  pola satu-tanggal seperti Tarik Tunai). Tiap baris retur dicocokkan **persis**
  ke `Sale` asli lewat `No.Penjualan` (== `Sale.noTransaksi`) + kode item per
  cabang; kalau ketemu, outlet/pegawai/HPP diwarisi langsung dari transaksi
  asli (HPP diprorata kalau retur sebagian). Kalau tidak ketemu (nota belum
  diimpor), jatuh ke outlet dari kolom `Cabang` di file + pegawai **"Tidak
  diketahui"**. Disimpan sebagai baris `Sale` baru dengan
  `isRetur=true`, `qty`/`subtotal`/`hpp`/`labaRugi` **negatif** dan
  `noTransaksi` = nomor retur (`SE...`) — bukan mengubah/menghapus baris
  penjualan asli, jadi otomatis mengurangi omzet/laba/poin pegawai lewat
  agregat yang sama, nol perubahan ke query manapun. Lihat
  [`parseSalesReturn.ts`](src/lib/parseSalesReturn.ts) dan
  [`importSalesReturn.ts`](src/lib/importSalesReturn.ts) untuk algoritma
  lengkapnya.
- **Riwayat Batch Import** — satu tabel gabungan untuk **semua** batch
  (penjualan biasa **dan** retur), dibedakan lewat badge kolom **Jenis**
  (`ImportBatch.isRetur`). Menghapus satu batch meng-cascade-delete semua
  `Sale` miliknya (termasuk retur) — jadi cara membatalkan sebuah import,
  bukan lewat undo terpisah.

**Akses:** `import`. **File:** [`ImportPage.tsx`](src/pages/import/ImportPage.tsx) +
[`SalesReturnImport.tsx`](src/components/SalesReturnImport.tsx) +
[`TartunServerImport.tsx`](src/components/TartunServerImport.tsx) →
[`importSales.ts`](src/lib/importSales.ts) /
[`importSalesReturn.ts`](src/lib/importSalesReturn.ts) /
[`importTartunServer.ts`](src/lib/importTartunServer.ts) →
[`routes/imports.ts`](src/server/routes/imports.ts).

**Catatan:** import **Master Item** (katalog resmi kode↔nama↔kategori per
cabang, §5b) letaknya bukan di sini — ada di Pengaturan → Master Item, karena
sifatnya konfigurasi katalog (master-only), bukan aktivitas harian.

### Analisa Data
`/analisa-data` — gabungan 3 sumber data (`Sale`, `TartunDaily`, `ServerDaily`)
dalam satu tabel unified, buat menelusuri/membandingkan semua jenis transaksi
tanpa pindah-pindah halaman. Badge **Retur** muncul di baris `Sale` yang
`isRetur=true`, dan keterangannya diberi prefix `[RETUR]`. Punya hapus baris
tunggal & hapus massal (master only) — untuk `TartunDaily`/`ServerDaily`,
menghapus satu baris berarti menghapus **agregat satu hari penuh** outlet itu,
bukan satu transaksi.
**Akses:** `data_explorer` (baca), `master` (hapus). **File:**
[`DataExplorerPage.tsx`](src/pages/dataexplorer/DataExplorerPage.tsx) →
[`queries/dataExplorer.ts`](src/lib/queries/dataExplorer.ts) →
[`routes/dataExplorer.ts`](src/server/routes/dataExplorer.ts).

### Log Aktivitas
`/log` — audit trail: siapa (`role:username`) melakukan apa, kapan, dari IP
mana. Diisi otomatis lewat `logActivity()` di setiap mutasi yang berarti
(login, import, ubah pengaturan, hapus data, dst) — lihat BLUEPRINT §7 untuk
konvensinya kalau menambah aksi baru yang perlu dicatat.
**Akses:** `activity_log`. **File:** [`ActivityLogPage.tsx`](src/pages/log/ActivityLogPage.tsx) →
`prisma.activityLog` langsung (tidak ada file query terpisah) →
[`routes/activityLog.ts`](src/server/routes/activityLog.ts).

### Pengaturan
`/settings` — **master only**, satu halaman panjang berisi banyak panel
collapsible independen (bukan tab terpisah). Urutan panel di halaman:

| Panel | Fungsi |
|---|---|
| Akun & Sesi | Kelola akun `admin` lain (buat/nonaktifkan/reset password/atur peran), lihat & paksa-logout sesi aktif. |
| Manajemen Peran | Buat `CustomRole` — daftar `FeatureKey` yang di-checklist untuk membatasi akun `admin` tertentu (§8). |
| Backup & Restore | Unduh/pulihkan **backup data** (Outlet/Employee/Item/ImportBatch/Sale/Tartun/Server — termasuk baris retur, karena itu tetap baris `Sale`) dan **backup pengaturan** (Target/mapping/aturan poin/peran) secara terpisah. Restore data **mengganti total** isi tabel-tabel itu (bukan merge) — lihat [`backup.ts`](src/lib/backup.ts). |
| Nominal Target (Bandung / Cimahi) | Angka target harian per `TargetScope`×`BusinessLine`×cabang — inilah yang dibandingkan Laporan Harian & baseline grafik Dashboard. |
| Pemetaan Cabang Outlet | Assign/pindah sebuah `Outlet` ke Bandung/Cimahi. Sengaja manual, bukan otomatis dari import — lihat catatan insiden 2026-09-13 di `importSales.ts` kenapa import tidak boleh mengubah branch outlet yang sudah ada. |
| Kategori Item Group | Peta `ItemGroup` (mentah dari POS) → `ReportCategory` (Petshop/Aksesoris/SP-Voucher) — dipakai Target Harian **dan** split leaderboard poin Bandung (§6.6). |
| Alias Outlet | Peta nama outlet versi export Tarik Tunai/Server (sering beda format, mis. "PARENT ...") ke `Outlet` kanonik. |
| Siklus Periode Poin | `PointSettings.periodStartDay` — kustomisasi kapan periode "per bulan" leaderboard poin dimulai (§6.2). |
| Pegawai Dikecualikan (Poin) | `PointsExclusion` — akun staff/admin/gudang yang tidak pernah muncul di leaderboard poin manapun. |
| Poin per Item | `ItemPoint` — aturan poin eksplisit per pola nama item (§6.1, cocok substring, pola terpanjang menang). |
| Item Dikecualikan (Poin) | `ItemPointExclusion` — item yang **selalu** 0 poin, menang atas aturan apa pun. |
| Poin per Kategori (Default) | `ItemGroupPointDefault` — nilai poin fallback per `ItemGroup` kalau item-nya tidak match `ItemPoint` manapun. |
| Visibilitas Outlet / Pegawai / Item | Toggle `isHidden` — dikecualikan dari **semua** analisa penjualan tapi datanya tetap ada, bisa dimunculkan lagi kapan saja (§6.5). |
| Master Item | Import katalog resmi kode↔nama↔kategori per cabang (§5b) — sumber kebenaran yang dipakai import penjualan untuk mencocokkan kode, bukan sebaliknya. |

**Akses:** `master` untuk seluruh halaman (bukan `FeatureKey` — lihat §8, akun
`admin` dengan `CustomRole` tidak pernah melihat menu ini sama sekali).
**File:** [`SettingsPage.tsx`](src/pages/settings/SettingsPage.tsx) (satu file
besar, ~3000 baris, satu bagian JSX per panel) → routes tersebar sesuai
domainnya masing-masing (`routes/accounts.ts`, `routes/roles.ts`,
`routes/backup.ts`, `routes/target.ts`, `routes/outlets.ts`,
`routes/mappings.ts`, `routes/points.ts`, `routes/items.ts`,
`routes/employees.ts`, `routes/masterItems.ts`).

---

## Halaman Publik (tanpa login)

### Papan Poin Karyawan
`/papan-poin` (Aksesoris), `/papan-poin/petshop` (Petshop), dan
`/papan-poin/sp` (SP/Voucher) — wallboard leaderboard poin untuk ditampilkan
di tablet/TV outlet, **tanpa login**.
Dibatasi rate limit (`publicPointsLimiter`, 60 req/menit/IP), dan **hanya**
pernah mengembalikan data poin/ranking — nol omzet, nol laba, nol HPP (lihat
komentar di [`publicPoints.ts`](src/server/routes/publicPoints.ts)). Desain
mengasumsikan port aplikasi hanya reachable dari jaringan privat (Tailscale) —
**bukan** dilindungi login, jadi keamanannya bergantung ke topologi jaringan
deployment, bukan ke kode. Cimahi belum punya wallboard publik (leaderboard-nya
belum dipisah kategori, §6.6).
**Akses:** publik + rate limit. **File:**
[`EmployeePointsDashboardPage.tsx`](src/pages/public/EmployeePointsDashboardPage.tsx) →
`getPublicPointsDashboard`/`getEmployeePointBreakdown` di
[`queries/points.ts`](src/lib/queries/points.ts) →
[`routes/publicPoints.ts`](src/server/routes/publicPoints.ts).

---

## Menambah fitur baru?

Ikuti urutan kerja di [`BLUEPRINT.md` §12](BLUEPRINT.md#12-menambah-fitur-baru--urutan-kerja),
lalu **tambahkan satu entri baru ke dokumen ini** — bagian mana pun yang
paling cocok (kalau menambah sidebar group baru, tambahkan judul bagian
baru juga). Fitur yang tidak tercatat di sini gampang terlupakan
strukturnya saat ada yang perlu menyentuhnya lagi enam bulan kemudian.
