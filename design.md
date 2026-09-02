# AnalisaBEe — Design System

Ringkasan visual dashboard/website AnalisaBEe saat ini, untuk dipakai sebagai
acuan saat redesign di Google Stitch. Gaya: **enterprise SaaS analytics
dashboard** — bersih, padat data, dark/light mode, aksen biru navy.

---

## 1. Konsep & Nuansa

- Command-center untuk analisa data penjualan retail (42 outlet, aksesoris HP).
- Data-dense: banyak tabel, angka besar (rupiah/qty), grafik tren kecil.
- Netral & profesional — bukan playful. Warna aksen dipakai sedikit (tombol,
  status aktif, garis grafik), sisanya grayscale.
- Mendukung **dark mode** (default mengikuti sistem) dan **light mode**,
  toggle manual tersedia di topbar.

---

## 2. Layout Global

```
┌─────────────┬──────────────────────────────────────────┐
│             │  Topbar (sticky, blur bg, h-16)           │
│  Sidebar    ├──────────────────────────────────────────┤
│  (w-60,     │                                            │
│  fixed,     │  Main content                              │
│  hidden on  │  max-width: 1600px, centered                │
│  mobile)    │  padding: 16px mobile / 32px desktop        │
│             │                                            │
└─────────────┴──────────────────────────────────────────┘
```

- **Sidebar**: lebar tetap `240px` (w-60), border kanan, background = surface.
  Disembunyikan di mobile (`hidden md:flex`), diganti navigasi horizontal
  scroll di Topbar mobile.
- **Topbar**: tinggi `64px` (h-16), sticky top, `background/80` + backdrop
  blur, border bawah. Isi: judul halaman aktif (kiri) + logo di mobile +
  theme toggle (kanan). Di mobile ada baris tab horizontal scrollable di
  bawah topbar untuk nav utama.
- **Main**: `max-w-[1600px]`, margin auto, padding `16px` (mobile) /
  `32px` (desktop), vertical rhythm antar section `space-y-6` (24px).
- Tidak ada shadow dekoratif — pemisahan area murni pakai `border` tipis
  1px warna `--border`, bukan drop shadow.

---

## 3. Warna (Design Tokens)

Didefinisikan sebagai CSS custom properties, di-switch lewat atribut
`data-theme="dark"` di root (`next-themes`, default: ikut sistem).

### Light (default)
| Token | Hex | Pemakaian |
|---|---|---|
| `--background` | `#f7f8fa` | Latar halaman |
| `--surface` | `#ffffff` | Card, tabel, sidebar, topbar |
| `--surface-hover` | `#f1f3f6` | Hover state row/nav item |
| `--border` | `#e4e7ec` | Semua border/divider |
| `--foreground` | `#0f1b2d` | Teks utama |
| `--muted` | `#5b6675` | Teks sekunder/label |
| `--accent` | `#1d3557` | Navy — tombol primer, link aktif, fokus |
| `--accent-foreground` | `#ffffff` | Teks di atas accent |
| `--positive` | `#0f9d58` | Angka naik / laba / status baik |
| `--negative` | `#d64545` | Angka turun / rugi / hapus |
| `--ring` | `#1d3557` | Focus ring |

### Dark
| Token | Hex | Pemakaian |
|---|---|---|
| `--background` | `#0a0d12` | |
| `--surface` | `#12161d` | |
| `--surface-hover` | `#1a2029` | |
| `--border` | `#232a35` | |
| `--foreground` | `#e7eaee` | |
| `--muted` | `#8b95a3` | |
| `--accent` | `#6ea8fe` | Biru terang (bukan navy — kontras di dark) |
| `--accent-foreground` | `#0a0d12` | |
| `--positive` | `#34d399` | |
| `--negative` | `#f87171` | |
| `--ring` | `#6ea8fe` | |

**Aturan pakai warna:**
- `positive`/`negative` HANYA untuk indikator naik/turun (badge tren, teks
  laba/rugi) dan tombol destruktif ("Hapus" = teks negative, bukan tombol
  merah solid).
- `accent` dipakai konsisten untuk semua tombol primer & state aktif —
  tidak ada warna aksen kedua/ketiga. Palet sengaja monokrom + 1 aksen.
- Badge tren pakai `accent`/`positive`/`negative` di atas versi
  transparan 10% dari warnanya sendiri (`bg-positive/10 text-positive`),
  bukan warna solid.

---

## 4. Tipografi

- Font: **Inter** (Google Font, variable), fallback system-ui/-apple-system.
- Tidak ada display font terpisah — semua ukuran pakai Inter dengan
  variasi weight/size.
- Skala yang dipakai:
  - `text-xl font-semibold` (20px) — judul halaman (H1)
  - `text-base font-semibold` (16px) — judul section/card (H2)
  - `text-sm` (14px) — body default, label form, isi tabel
  - `text-xs` (12px) — caption, label kecil di atas input, footnote sidebar
  - `text-2xl` / `text-xl xl:text-2xl font-semibold tabular-nums` — angka
    besar di KPI card
- Angka SELALU pakai `tabular-nums` supaya kolom rapi.
- Warna teks: `foreground` untuk konten utama, `muted` untuk label/deskripsi
  sekunder — tidak ada teks hitam pekat/abu gelap di luar 2 token ini.

---

## 5. Komponen

### Card / Section container
Pola dasar yang dipakai berulang di semua halaman:
```
rounded-xl border border-border bg-surface p-4   (KPI card, panel filter)
rounded-xl border border-border bg-surface p-5   (section pengaturan, form)
rounded-lg border border-border bg-surface        (wrapper tabel)
```
Radius: `xl` (12px) untuk card/section, `lg` (8px) untuk tabel/tombol kecil,
`md` (6px) untuk input & tombol.

### KPI Card (dengan sparkline) — `SparkKpiCard`
- Label kecil (muted) + badge tren (▲/▼ persen, pill rounded-full) di kanan.
- Angka besar di bawahnya.
- Area chart mini (sparkline) di dasar card, tinggi 32px, gradient fill dari
  `accent` 35%→0% opacity, tanpa animasi, tanpa axis/grid/tooltip.

### Stat Card (tanpa chart) — `StatCard`
- Sama seperti KPI card tapi tanpa badge tren & tanpa sparkline. Dipakai
  untuk angka count sederhana (jumlah transaksi/outlet/item/pegawai).

### Tabel — `SortableTable`
- Wrapper `rounded-lg border border-border bg-surface`, `overflow-x-auto`.
- Header: `bg-background`, teks `muted`, klik header untuk sort
  (indikator ▲/▼ inline di sebelah label), cursor pointer, hover→foreground.
- Body: `divide-y divide-border` antar baris, tanpa hover highlight khusus
  (polos), padding sel `px-4 py-2`.
- Kolom angka rata kanan (`text-right`), kolom teks rata kiri.
- Empty state: baris tunggal center, teks muted, pesan kontekstual
  ("Belum ada data.").

### Form input / select
```
rounded-md border border-border bg-background px-2 py-1.5 text-sm
```
- Label selalu di atas input: `text-xs text-muted mb-1`, block.
- Grup filter (misalnya panel tanggal+outlet) disusun `flex flex-wrap
  items-end gap-3` di dalam card `p-4`.

### Tombol
- **Primary**: `rounded-md bg-accent text-accent-foreground px-3 py-1.5
  text-sm font-medium hover:opacity-90` (disabled: `opacity-50`). Ukuran
  lebih besar (`px-4 py-2`) untuk CTA utama (mis. tombol "Simpan" berdiri
  sendiri, "Import Data" di empty state).
- **Secondary/text**: `text-sm text-muted hover:text-foreground underline`
  — dipakai untuk aksi sekunder seperti "Reset"/"Lihat Semua Data".
- **Destructive**: teks saja, `text-negative`, tanpa background solid
  (mis. "Hapus" di baris tabel).
- Tidak ada tombol outline/ghost bordered — hanya 3 pola di atas.

### Navigasi (Sidebar)
- Item nav: `flex items-center gap-3 rounded-md px-3 py-2 text-sm`.
- Aktif: `bg-accent text-accent-foreground font-medium`.
- Non-aktif: `text-muted`, hover → `bg-surface-hover text-foreground`.
- Icon: outline SVG 16×16, `stroke="currentColor"` strokeWidth 2,
  round line-cap/join (gaya Feather/Lucide-like, digambar manual sebagai
  inline path, bukan library icon).
- Logo: "Analisa**BEe**" — teks biasa + kata "BEe" di-highlight warna
  `accent`.

### Badge tren (naik/turun)
```
inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5
rounded-full  →  bg-positive/10 text-positive  ATAU  bg-negative/10 text-negative
```
Isi: simbol ▲/▼ + persen 1 desimal.

### Chart
- Library: Recharts.
- Warna garis/area utama chart selalu `var(--accent)`.
- Gaya minimal: tanpa border/shadow chart container di luar card, animasi
  dimatikan (`isAnimationActive={false}`) untuk konsistensi render.
- Tipe yang dipakai: Area chart (tren omzet/qty), Pie/Donut (komposisi),
  Bar (perbandingan outlet/item), sparkline mini di KPI card.

### Modal (konfirmasi hapus)
- Dipakai untuk aksi destruktif yang butuh ketik ulang nama untuk konfirmasi
  (mis. hapus batch import) — pola "type to confirm", bukan sekadar
  Ya/Tidak.

---

## 6. Spacing & Grid

- Grid KPI utama: `grid grid-cols-1 lg:grid-cols-3 gap-3` (3 kolom di
  desktop, stack di mobile).
- Grid stat sekunder: `grid grid-cols-2 lg:grid-cols-4 gap-3`.
- Spacing vertikal antar blok section: `space-y-6` (24px).
- Padding card konsisten: `p-4` (KPI/filter) atau `p-5` (form/settings
  section) — kelipatan 4px selalu.
- Gap antar elemen form inline: `gap-2` s/d `gap-3`.

---

## 7. Pola Konten Khas Aplikasi Ini

- **Header halaman**: judul (H1) + subjudul kontekstual di kiri (mis.
  "Menampilkan 1 Sep – 2 Sep (default)."), info meta di kanan (mis.
  "Import terakhir: ...").
- **Default rentang tanggal**: kemarin–hari ini, dengan link teks
  "Lihat Semua Data" sebagai escape hatch — pola ini konsisten di semua
  halaman berbasis tanggal.
- **Empty state**: ikon opsional, judul singkat, deskripsi muted, 1 CTA
  primary. Untuk "tidak ada data pada filter", pakai border dashed +
  padding besar (`border-dashed border-border rounded-lg p-8 text-center`).
- **Leaderboard**: tabel ranking dengan baris yang bisa di-expand
  (klik → tampilkan breakdown per item) memakai `<Fragment>`.
- Semua label UI dan pesan dalam **Bahasa Indonesia**.

---

## 8. Ringkasan untuk Prompt Google Stitch

Jika dipakai sebagai prompt singkat ke Stitch:

> Enterprise SaaS analytics dashboard, dark & light mode, warna netral
> abu-abu/putih dengan satu aksen navy blue (#1d3557 light / #6ea8fe
> dark). Font Inter. Sidebar kiri tetap 240px dengan ikon outline garis
> tipis, topbar atas sticky dengan blur. Card dengan border tipis
> (bukan shadow), radius 12px, KPI card dengan sparkline mini dan badge
> tren hijau/merah pill. Tabel data padat dengan header sortable, border
> antar baris tipis, tanpa hover berat. Tombol utama solid navy dengan
> teks putih, radius 6px. Gaya keseluruhan: bersih, data-dense, minim
> dekorasi, cocok untuk dashboard retail/analitik multi-cabang.
