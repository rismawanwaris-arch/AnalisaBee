import { createHash } from "crypto";

/**
 * Dedup key for a raw sales row. Built from every column in the source
 * export so re-uploading a file (or an overlapping period) never inserts
 * the same sale twice, while a genuinely distinct row still hashes uniquely.
 */
export function rowHash(fields: (string | number)[]): string {
  return createHash("sha256").update(fields.join("|")).digest("hex");
}
