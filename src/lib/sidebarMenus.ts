import type { FeatureKey } from "./features";

export interface SidebarMenuItem {
  href: string;
  label: string;
  group: string;
  feature?: FeatureKey;
  masterOnly?: boolean;
  external?: boolean;
  exact?: boolean;
  // If true, this menu item cannot be hidden (e.g. /settings so admins never lock themselves out)
  required?: boolean;
  description?: string;
}

export interface SidebarMenuGroup {
  name: string;
  items: SidebarMenuItem[];
}

export const SIDEBAR_MENU_GROUPS: SidebarMenuGroup[] = [
  {
    name: "Cabang Bandung",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        group: "Cabang Bandung",
        feature: "dashboard",
        description: "Ringkasan metrik penjualan cabang Bandung",
      },
      {
        href: "/target",
        label: "Target Harian",
        group: "Cabang Bandung",
        feature: "target_bandung",
        description: "Laporan pencapaian target harian Bandung",
      },
      {
        href: "/points",
        label: "Poin Aksesoris",
        group: "Cabang Bandung",
        feature: "points",
        exact: true,
        description: "Klasemen & komisi poin kategori Aksesoris",
      },
      {
        href: "/points/petshop",
        label: "Poin Petshop",
        group: "Cabang Bandung",
        feature: "points_petshop",
        description: "Klasemen & komisi poin kategori Petshop",
      },
      {
        href: "/points/sp",
        label: "Poin SP/Voucher",
        group: "Cabang Bandung",
        feature: "points_sp",
        description: "Klasemen & komisi poin kategori SP/Voucher",
      },
      {
        href: "/papan-poin",
        label: "Papan Poin (TV)",
        group: "Cabang Bandung",
        external: true,
        description: "Tampilan layar TV klasemen poin Bandung",
      },
    ],
  },
  {
    name: "Cabang Cimahi",
    items: [
      {
        href: "/cimahi/dashboard",
        label: "Dashboard",
        group: "Cabang Cimahi",
        feature: "dashboard_cimahi",
        description: "Ringkasan metrik penjualan cabang Cimahi",
      },
      {
        href: "/cimahi/target",
        label: "Target Harian",
        group: "Cabang Cimahi",
        feature: "target_cimahi",
        description: "Laporan pencapaian target harian Cimahi",
      },
      {
        href: "/cimahi/points",
        label: "Poin Aksesoris",
        group: "Cabang Cimahi",
        feature: "points_cimahi",
        exact: true,
        description: "Klasemen & komisi poin kategori Aksesoris Cimahi",
      },
      {
        href: "/cimahi/points/petshop",
        label: "Poin Petshop",
        group: "Cabang Cimahi",
        feature: "points_cimahi_petshop",
        description: "Klasemen & komisi poin kategori Petshop Cimahi",
      },
      {
        href: "/cimahi/points/sp",
        label: "Poin SP/Voucher",
        group: "Cabang Cimahi",
        feature: "points_cimahi_sp",
        description: "Klasemen & komisi poin kategori SP/Voucher Cimahi",
      },
      {
        href: "/papan-poin/cimahi",
        label: "Papan Poin (TV)",
        group: "Cabang Cimahi",
        external: true,
        description: "Tampilan layar TV klasemen poin Cimahi",
      },
    ],
  },
  {
    name: "Dimensi Analisis",
    items: [
      {
        href: "/items",
        label: "Item & SKU",
        group: "Dimensi Analisis",
        feature: "items",
        exact: true,
        description: "Pencarian detail dan riwayat penjualan per item",
      },
      {
        href: "/items/categories",
        label: "Kategori Item",
        group: "Dimensi Analisis",
        feature: "item_categories",
        description: "Performa penjualan agregat per kelompok kategori",
      },
      {
        href: "/outlets",
        label: "Performa Outlet",
        group: "Dimensi Analisis",
        feature: "outlets",
        description: "Matriks performa dan komparasi antar outlet",
      },
      {
        href: "/employees",
        label: "Pegawai & Staff",
        group: "Dimensi Analisis",
        feature: "employees",
        description: "Performa penjualan dan produktivitas pegawai",
      },
      {
        href: "/transactions",
        label: "Daftar Transaksi",
        group: "Dimensi Analisis",
        feature: "transactions",
        description: "Audit log transaksi penjualan lengkap",
      },
    ],
  },
  {
    name: "Manajemen Data & Sistem",
    items: [
      {
        href: "/import",
        label: "Import & Batch",
        group: "Manajemen Data & Sistem",
        feature: "import",
        description: "Upload file excel penjualan POS dan retur",
      },
      {
        href: "/analisa-data",
        label: "Analisa Data",
        group: "Manajemen Data & Sistem",
        feature: "data_explorer",
        description: "Pencarian dan pembersihan transaksi mentah",
      },
      {
        href: "/log",
        label: "Log Aktivitas",
        group: "Manajemen Data & Sistem",
        feature: "activity_log",
        description: "Audit trail perubahan dan aktivitas sistem",
      },
      {
        href: "/settings",
        label: "Pengaturan",
        group: "Manajemen Data & Sistem",
        masterOnly: true,
        required: true,
        description: "Konfigurasi sistem, akun, target, dan visibilitas (Wajib tampil)",
      },
    ],
  },
];

export const ALL_SIDEBAR_MENUS: SidebarMenuItem[] = SIDEBAR_MENU_GROUPS.flatMap((g) => g.items);

export const REQUIRED_MENU_HREFS = new Set<string>(
  ALL_SIDEBAR_MENUS.filter((m) => m.required).map((m) => m.href)
);
