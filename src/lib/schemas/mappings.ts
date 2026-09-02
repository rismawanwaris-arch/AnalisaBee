import { z } from "zod";

const REPORT_CATEGORIES = ["PETSHOP", "AKSESORIS", "SP_VOUCHER"] as const;

export const itemGroupMappingSchema = z.object({
  itemGroup: z
    .string({ error: "Nama Item Group tidak boleh kosong." })
    .trim()
    .min(1, "Nama Item Group tidak boleh kosong.")
    .transform((s) => s.toUpperCase()),
  category: z.enum(REPORT_CATEGORIES, { error: "Kategori tujuan tidak valid." }),
});

export const outletAliasSchema = z.object({
  alias: z
    .string({ error: "Nama alias tidak boleh kosong." })
    .trim()
    .min(1, "Nama alias tidak boleh kosong.")
    .transform((s) => s.toUpperCase()),
  outletId: z.coerce.number({ error: "Outlet tujuan tidak valid." }).int("Outlet tujuan tidak valid."),
});
