# 📖 Buku Panduan Penggunaan Aplikasi AnalisaBEe
> **Panduan Operasional Lengkap untuk Tim Admin & Pengelola Toko**  
> Versi Dokumen: 1.0 | Terakhir Diperbarui: September 2026

---

## Daftar Isi
1. [Pengenalan & Akses Sistem](#1-pengenalan--akses-sistem)
2. [Navigasi & Tampilan Antarmuka](#2-navigasi--tampilan-antarmuka)
3. [Panduan Menu Cabang (Bandung & Cimahi)](#3-panduan-menu-cabang-bandung--cimahi)
   - [Dashboard Eksekutif](#dashboard-eksekutif)
   - [Target Harian (Laporan Capaian)](#target-harian-laporan-capaian)
   - [Analitik Target](#analitik-target)
   - [Jam Operasional](#jam-operasional)
   - [Poin Penjualan (Aksesoris, Petshop, SP/Voucher)](#poin-penjualan-aksesoris-petshop-spvoucher)
   - [Papan Poin (Display TV Outlet)](#papan-poin-display-tv-outlet)
4. [Panduan Menu Dimensi Analisis](#4-panduan-menu-dimensi-analisis)
   - [Item & SKU](#item--sku)
   - [Kategori Item](#kategori-item)
   - [Performa Outlet](#performa-outlet)
   - [Pegawai & Staff](#pegawai--staff)
   - [Daftar Transaksi](#daftar-transaksi)
5. [Panduan Manajemen Data (Import & Audit)](#5-panduan-manajemen-data-import--audit)
   - [Import Penjualan POS](#import-penjualan-pos)
   - [Import Retur Penjualan](#import-retur-penjualan)
   - [Input Data Tarik Tunai & Server](#input-data-tarik-tunai--server)
   - [Riwayat Batch & Pembatalan Import](#riwayat-batch--pembatalan-import)
   - [Analisa Data Terpadu & Log Aktivitas](#analisa-data-terpadu--log-aktivitas)
6. [Panduan Menu Pengaturan (Khusus Master)](#6-panduan-menu-pengaturan-khusus-master)
7. [Tanya Jawab & Solusi Kendala (FAQ)](#7-tanya-jawab--solusi-kendala-faq)

---

## 1. Pengenalan & Akses Sistem

**AnalisaBEe** adalah platform intelijen bisnis yang menggabungkan seluruh data transaksi dari berbagai cabang dan outlet ritel. Sistem ini menyatukan 3 sumber data utama:
1. **Penjualan POS** (Aksesoris, Petshop, SP/Voucher)
2. **Jasa Tarik Tunai**
3. **Komisi Server Pulsa/Paket Data**

### Cara Masuk (Login)
1. Buka browser dan akses alamat aplikasi: `http://localhost:3000` (atau tautan jaringan kantor/Tailscale yang disediakan).
2. Masukkan **Username** dan **Kata Sandi** yang telah diberikan oleh Master.
3. Klik tombol **Masuk ke Dashboard**.
4. *Catatan untuk Kasir/Outlet:* Untuk membuka layar leaderboard poin di toko/TV, tidak perlu login. Klik tombol shortcut **Aksesoris**, **Petshop**, atau **SP/Voucher** yang ada tepat di bawah tombol login.

---

## 2. Navigasi & Tampilan Antarmuka

Antarmuka AnalisaBEe terdiri dari:
- **Sidebar Kiri:** Menu navigasi utama yang dikelompokkan berdasarkan Cabang Bandung, Cabang Cimahi, Dimensi Analisis, Manajemen Sistem, dan Pengaturan.
- **Widget Status Operasional (Sidebar Atas):** Menampilkan jumlah total baris transaksi di database serta nama file Excel yang terakhir kali diimpor.
- **Header Atas (Topbar):** Menampilkan tanggal sistem, tombol ganti tema (Terang / Gelap), nama pengguna yang sedang aktif, dan tombol **Keluar (Logout)**.

---

## 3. Panduan Menu Cabang (Bandung & Cimahi)

Kedua cabang memiliki struktur menu yang setara dan data yang terisolasi secara akurat.

### Dashboard Eksekutif
* **Alamat:** `/dashboard` (Bandung) atau `/cimahi/dashboard` (Cimahi)
* **Tujuan:** Mendapatkan gambaran umum performa bisnis secara cepat.
* **Cara Menggunakan:**
  1. Pilih rentang tanggal pada kotak filter tanggal (misal: *Hari Ini*, *Bulan Ini*, atau tentukan tanggal sendiri).
  2. Perhatikan 4 kartu ringkasan: **Total Omzet**, **Total Laba Kotor**, **Total Qty Terjual**, dan **Jumlah Transaksi**.
  3. Periksa grafik tren harian: Garis biru putus-putus menunjukkan baseline target laba toko.
  4. Lihat tabel **Top 5 Item Terlaris** dan **Top 5 Outlet** untuk melihat penyumbang penjualan terbesar.

### Target Harian (Laporan Capaian)
* **Alamat:** `/target` (Bandung) atau `/cimahi/target` (Cimahi)
* **Tujuan:** Memeriksa apakah outlet memenuhi target penjualan harian pada 5 lini bisnis: *Aksesoris, Petshop, SP/Voucher, Tarik Tunai,* dan *Komisi Server*.
* **Cara Menggunakan:**
  1. Masukkan rentang tanggal yang ingin dianalisis. Target harian akan otomatis dikalikan dengan jumlah hari yang dipilih secara proporsional (*apple-to-apple*).
  2. Kolom tabel menampilkan:
     * **Nama Outlet**
     * **Nominal Capaian vs Target** untuk masing-masing 5 lini bisnis.
     * **Badge Status:** Berwarna **Hijau** jika mencapai target (≥ 100%), dan **Merah/Abu** jika belum mencapai target.
  3. Di bagian atas tabel terdapat ringkasan **Persentase Capaian Jaringan** secara menyeluruh.
  4. *Tips:* Jumlah angka di belakang koma (1, 2, atau 3 desimal) dapat disesuaikan melalui menu Pengaturan agar tampilan angka lebih rapi atau lebih mendetail.

### Analitik Target
* **Alamat:** `/target/analitik` atau `/cimahi/target/analitik`
* **Tujuan:** Analisis grafis mendalam untuk kebutuhan rapat evaluasi pimpinan.
* **Fitur:** Menampilkan visualisasi diagram batang, proporsi laba per lini, dan matriks pencapaian target per outlet.

### Jam Operasional
* **Alamat:** `/target/jam-operasional` atau `/cimahi/target/jam-operasional`
* **Tujuan:** Mengetahui pola jam sibuk toko (*peak hours*).
* **Cara Menggunakan:**
  1. Pilih tanggal atau bulan yang ingin dianalisis.
  2. Perhatikan grafik kurva 24 jam (jam 07.00 - 22.00).
  3. Grafik ini menunjukkan jam berapa transaksi paling padat terjadi. Gunakan informasi ini untuk mengatur jam istirahat kasir dan jadwal pergantian shift.

### Poin Penjualan (Aksesoris, Petshop, SP/Voucher)
* **Alamat:** 
  * Bandung: `/points` (Aksesoris), `/points/petshop` (Petshop), `/points/sp` (SP/Voucher)
  * Cimahi: `/cimahi/points`, `/cimahi/points/petshop`, `/cimahi/points/sp`
* **Tujuan:** Menghitung perolehan poin penjualan kasir/staff toko untuk insentif dan komisi.
* **Cara Menggunakan:**
  1. Pilih tab kategori yang ingin dinilai (**Aksesoris**, **Petshop**, atau **SP/Voucher**).
  2. Pilih mode periode: **Per Bulan** (mengikuti siklus cut-off toko), **Per Hari**, atau **Rentang Bebas**.
  3. Peringkat karyawan diurutkan dari poin tertinggi ke terendah.
  4. **Melihat Rincian Item:** Klik baris nama karyawan untuk membuka rincian produk apa saja yang berhasil dijual karyawan tersebut beserta jumlah poin per pcs.
  5. **Export Excel:** Klik tombol hijau **Export Excel** di kanan atas untuk mengunduh rekapitulasi poin seluruh karyawan dalam format spreadsheet `.xlsx` siap pakai untuk bagian penggajian/payroll.

### Papan Poin (Display TV Outlet)
* **Alamat:** `/papan-poin` (Bandung) atau `/papan-poin/cimahi` (Cimahi)
* **Tujuan:** Ditampilkan pada Smart TV atau tablet di konter outlet sebagai papan motivasi karyawan.
* **Keunggulan:**
  * **Tanpa Login:** Tidak memerlukan akun admin sehingga aman dipasang di toko.
  * **Aman & Privasi:** Hanya menampilkan nama pegawai, outlet, jumlah pcs, dan poin. Data sensitif seperti harga modal (HPP), omzet rupiah, dan laba kotor toko otomatis disembunyikan.
  * **Auto-Refresh:** Layar otomatis memperbarui data secara langsung setiap 60 detik tanpa perlu menyentuh layar.

---

## 4. Panduan Menu Dimensi Analisis

### Item & SKU (`/items`)
* Gunakan menu ini untuk menelusuri satu barang spesifik.
* Cari berdasarkan nama produk atau barcode/SKU (misal: `"Kabel Data Robot"`).
* Klik nama barang untuk melihat:
  * Total unit terjual, total omzet, dan total laba.
  * Outlet mana yang paling cepat menjual barang tersebut (*sebaran outlet*).
  * Riwayat transaksi tanggal penjualan.

### Kategori Item (`/items/categories`)
* Menampilkan daftar seluruh SKU yang dikelompokkan berdasarkan kategori produk.
* **Fitur Total Otomatis:** Di bagian bawah tabel terdapat baris **Total** tebal yang otomatis menjumlahkan Qty Terjual, Total Omzet, dan Total Laba sesuai filter pencarian yang sedang aktif.
* **Tombol Mode:** Klik tombol `▤ Tampilan Semua Item` atau `▦ Tampilan Ringkasan Kategori` untuk melihat rekapitulasi per kategori besar.

### Performa Outlet (`/outlets`)
* Membandingkan kinerja seluruh toko dalam satu tabel matriks.
* Lengkap dengan filter merk barang, karyawan yang bertugas, dan rentang tanggal.
* Baris **Total Keseluruhan** di bagian bawah merangkum performa semua outlet.
* Klik nama outlet untuk masuk ke halaman detail outlet bersangkutan.

### Pegawai & Staff (`/employees`)
* Menampilkan seluruh daftar staff dan akumulasi omzet yang mereka hasilkan.
* Klik nama pegawai untuk melihat riwayat penjualan dan item favorit yang sering dijual oleh pegawai tersebut.

### Daftar Transaksi (`/transactions`)
* Audit baris demi baris seluruh nota penjualan kasir.
* Mendukung filter nomor nota, nama kasir, jam transaksi, rentang nominal, dan jenis transaksi.
* **Mengenali Retur:** Transaksi retur barang ditandai dengan nomor nota berawalan `SE...` dan nominal angka bertanda minus (`-`).
* Terdapat tombol **Export CSV** untuk audit pembukuan.

---

## 5. Panduan Manajemen Data (Import & Audit)

Menu **Import & Batch** (`/import`) adalah pusat pembaruan data harian.

### Import Penjualan POS
1. Buka menu **Import & Batch** (`/import`).
2. Pada bagian **Import Penjualan**, pilih cabang target (**Bandung** atau **Cimahi**).
3. Seret file Excel laporan POS (`.xls` atau `.xlsx`) ke kotak unggah, atau klik untuk memilih file.
4. **Tahap Pratinjau (Preview):** Sistem akan membaca file dan menampilkan ringkasan:
   * Jumlah baris baru yang akan masuk.
   * Jumlah baris duplikat yang diabaikan (aman diunggah berulang kali tanpa membuat data ganda).
   * Nilai total omzet dalam file.
5. Jika data pratinjau sudah sesuai, klik tombol **Simpan Penjualan ke Database**.

### Import Retur Penjualan
1. Pada halaman yang sama, buka tab/panel **Retur Penjualan**.
2. Pilih cabang target dan unggah file rekap retur harian dari POS.
3. Sistem secara otomatis mencocokkan nomor nota retur ke transaksi aslinya:
   * Mengurangi omzet dan laba toko pada tanggal terjadinya retur.
   * Mengurangi poin karyawan yang melakukan penjualan barang tersebut.
4. Klik tombol **Simpan Data Retur**.

### Input Data Tarik Tunai & Server
1. Buka panel **Data Tarik Tunai & Komisi Server**.
2. Pilih tanggal laporan dan cabang.
3. Salin (*copy*) teks rekapitulasi nominal dari WhatsApp/catatan harian, lalu tempel (*paste*) ke kolom input.
4. Sistem otomatis memetakan nama outlet dan nominalnya.
5. Klik **Simpan Data**. Data ini bersifat *upsert* (jika tanggal dan outlet yang sama diunggah ulang, data lama akan diperbarui, bukan bertambah ganda).

### Riwayat Batch & Pembatalan Import
* Di bagian bawah halaman Import, terdapat tabel **Riwayat Batch Import**.
* Jika salah memasukkan file Excel, cari nama file tersebut pada tabel riwayat, lalu klik tombol **Hapus Batch**.
* Sistem akan membatalkan seluruh transaksi yang berasal dari file tersebut secara bersih (*clean rollback*) tanpa merusak data penjualan lainnya.

### Analisa Data Terpadu & Log Aktivitas
* **Analisa Data (`/analisa-data`):** Menampilkan gabungan data penjualan POS, Tarik Tunai, dan Server dalam satu tabel pencarian terpadu.
* **Log Aktivitas (`/log`):** Buku audit digital yang mencatat setiap aktivitas admin (siapa yang login, mengimpor file, menghapus data, atau mengubah pengaturan).

---

## 6. Panduan Menu Pengaturan (Khusus Master)

Menu **Pengaturan** (`/settings`) hanya dapat diakses oleh akun tingkat **Master**:
1. **Manajemen Akun & Sesi:** Membuat akun admin baru, mereset password staf, membatasi hak akses menu dengan *Peran Kustom*, serta mengeluarkan (*force logout*) sesi yang mencurigakan.
2. **Nominal Target Penjualan:** Mengatur target nominal harian per lini bisnis untuk masing-masing outlet Bandung dan Cimahi.
3. **Format Angka Desimal:** Menentukan jumlah angka di belakang koma (1, 2, atau 3 angka) pada Laporan Target Harian.
4. **Aturan Poin:** Menentukan berapa poin per pcs untuk barang promo tertentu, mengatur poin default grup barang, serta mengecualikan akun non-kasir (seperti gudang/admin) agar tidak masuk ke papan poin.
5. **Visibilitas Outlet, Pegawai, & Item:** Menyembunyikan outlet yang tutup atau pegawai yang resign tanpa menghapus catatan transaksi masa lalunya.
6. **Backup & Restore:** Mengunduh berkas cadangan database sewaktu-waktu dan memulihkannya jika diperlukan.

---

## 7. Tanya Jawab & Solusi Kendala (FAQ)

**Q: Mengapa file Excel penjualan ditolak saat diimpor?**  
> *Pastikan file berformat `.xls` atau `.xlsx` asli dari software POS. Jangan mengubah nama kolom header standar (seperti No.Transaksi, Kode Item, Qty, Total, dll).*

**Q: Apakah aman mengimpor file dengan rentang tanggal yang tumpang tindih?**  
> *Sangat aman. AnalisaBEe menggunakan enkripsi hash baris unik (`rowHash`). Transaksi yang sudah pernah masuk akan otomatis ditandai sebagai duplikat dan dilewati.*

**Q: Mengapa ada nama kasir yang tidak muncul di Papan Poin?**  
> *Periksa menu Pengaturan → Pegawai Dikecualikan. Pastikan nama pegawai tersebut tidak dimasukkan ke dalam daftar akun yang dikecualikan dari kompetisi poin.*

**Q: Bagaimana cara memasang Papan Poin di Smart TV toko?**  
> *Buka browser di Smart TV atau tablet toko, masukkan alamat `http://[IP-Komputer]:3000/papan-poin` (atau `/papan-poin/cimahi` untuk Cimahi). Layar akan tampil penuh tanpa butuh login dan akan selalu terbarui secara otomatis.*

---
*AnalisaBEe — Sistem Cerdas Analisis & Intelijen Ritel Multi-Outlet.*
