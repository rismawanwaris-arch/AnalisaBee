import type { Prisma } from "@/generated/prisma/client";

/**
 * Sale-scoped filter that drops every line-item belonging to a hidden Item
 * (Item.isHidden). Applied across all sales-analysis surfaces — Dashboard,
 * Performa Outlet, Pegawai, Daftar Transaksi, Analisa Data, Jam Operasional and
 * the daily target report — so a hidden item disappears from omzet / laba / qty
 * / tren and transaction counts, not just from lists and rankings.
 *
 * NOT applied to: the item's own detail page (/items?id=), the raw import, the
 * "Visibilitas Item" settings panel (which must still show each item's omzet),
 * data backups, and the points engine (points have their own
 * ItemPointExclusion mechanism).
 */
export const EXCLUDE_HIDDEN_ITEMS = {
  item: { isHidden: false },
} satisfies Prisma.SaleWhereInput;
