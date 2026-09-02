import { z } from "zod";

const SCOPES = ["PERKONTER", "ALL"] as const;
const BUSINESS_LINES = ["SERVER", "TARTUN", "PETSHOP", "AKSESORIS", "SP_VOUCHER"] as const;

const targetEntrySchema = z.object({
  scope: z.enum(SCOPES, { error: "Data target tidak valid." }),
  category: z.enum(BUSINESS_LINES, { error: "Data target tidak valid." }),
  amount: z.coerce
    .number({ error: "Data target tidak valid." })
    .finite("Data target tidak valid.")
    .min(0, "Data target tidak valid."),
});

export const targetBatchSchema = z.array(targetEntrySchema, { error: "Body harus berupa array." });
