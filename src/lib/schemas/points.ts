import { z } from "zod";

export const itemPointRuleSchema = z.object({
  pattern: z
    .string({ error: "Nama/pola item tidak boleh kosong." })
    .trim()
    .min(1, "Nama/pola item tidak boleh kosong."),
  points: z.coerce
    .number({ error: "Poin harus berupa angka bulat >= 0." })
    .int("Poin harus berupa angka bulat >= 0.")
    .min(0, "Poin harus berupa angka bulat >= 0."),
});

export const groupPointDefaultSchema = z.object({
  itemGroup: z
    .string({ error: "Nama Item Group tidak boleh kosong." })
    .trim()
    .min(1, "Nama Item Group tidak boleh kosong.")
    .transform((s) => s.toUpperCase()),
  points: z.coerce
    .number({ error: "Poin harus berupa angka bulat >= 0." })
    .int("Poin harus berupa angka bulat >= 0.")
    .min(0, "Poin harus berupa angka bulat >= 0."),
});

export const itemPointExclusionSchema = z.object({
  pattern: z
    .string({ error: "Nama/pola item tidak boleh kosong." })
    .trim()
    .min(1, "Nama/pola item tidak boleh kosong."),
});

export const excludeEmployeeSchema = z.object({
  employeeId: z.coerce.number({ error: "Pegawai tidak valid." }).int("Pegawai tidak valid."),
  reason: z
    .string()
    .trim()
    .optional()
    .transform((s) => (s ? s : undefined)),
});

export const periodSettingSchema = z.object({
  periodStartDay: z.coerce
    .number({ error: "Tanggal mulai periode harus angka 1-31." })
    .int("Tanggal mulai periode harus angka 1-31.")
    .min(1, "Tanggal mulai periode harus angka 1-31.")
    .max(31, "Tanggal mulai periode harus angka 1-31."),
});
