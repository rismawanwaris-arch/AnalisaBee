// Default POS "Item Group" → report-category mapping, carried over from the
// standalone "Laporan Harian" tool.
export const DEFAULT_GROUP_MAP: Record<string, "PETSHOP" | "AKSESORIS" | "SP_VOUCHER"> = {
  PETSHOP: "PETSHOP",
  "ACC CAMPURAN NEW": "AKSESORIS",
  "ACC CAMPURAN LAMA": "AKSESORIS",
  ATK: "AKSESORIS",
  "KERTAS STRUK": "AKSESORIS",
  SP: "SP_VOUCHER",
  VOUCHER: "SP_VOUCHER",
};
