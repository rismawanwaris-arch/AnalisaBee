// The set of sidebar-level features a custom role can be granted. Kept as a
// flat list (not per-action) per the page/section-level access decision —
// having a key grants full read access to that area; mutating endpoints
// inside it that were already master-only (editing targets, mappings,
// visibility, etc.) stay master-only regardless of this list.
export const FEATURE_KEYS = [
  "dashboard",
  "target_bandung",
  "points",
  "target_cimahi",
  "items",
  "item_categories",
  "outlets",
  "employees",
  "transactions",
  "import",
  "activity_log",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  dashboard: "Dashboard",
  target_bandung: "Target Harian — Bandung",
  points: "Poin Penjualan",
  target_cimahi: "Target Harian — Cimahi",
  items: "Item & SKU",
  item_categories: "Kategori Item",
  outlets: "Performa Outlet",
  employees: "Pegawai & Staff",
  transactions: "Daftar Transaksi",
  import: "Import & Batch",
  activity_log: "Log Aktivitas",
};

export function isFeatureKey(value: unknown): value is FeatureKey {
  return typeof value === "string" && (FEATURE_KEYS as readonly string[]).includes(value);
}
