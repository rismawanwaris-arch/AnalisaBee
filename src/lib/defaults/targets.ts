import type { BusinessLine } from "@/generated/prisma/client";

// Default daily targets, carried over from the standalone "Laporan Harian" tool.
export const DEFAULT_TARGETS: {
  scope: "PERKONTER" | "ALL";
  category: BusinessLine;
  amount: number;
}[] = [
  { scope: "PERKONTER", category: "SERVER", amount: 200_000 },
  { scope: "PERKONTER", category: "TARTUN", amount: 100_000 },
  { scope: "PERKONTER", category: "PETSHOP", amount: 35_000 },
  { scope: "PERKONTER", category: "AKSESORIS", amount: 35_000 },
  { scope: "PERKONTER", category: "SP_VOUCHER", amount: 100_000 },
  { scope: "ALL", category: "SERVER", amount: 8_000_000 },
  { scope: "ALL", category: "TARTUN", amount: 4_000_000 },
  { scope: "ALL", category: "PETSHOP", amount: 1_190_000 },
  { scope: "ALL", category: "AKSESORIS", amount: 1_400_000 },
  { scope: "ALL", category: "SP_VOUCHER", amount: 4_000_000 },
];
