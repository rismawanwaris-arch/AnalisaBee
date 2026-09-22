/**
 * Generates a ready-to-edit Master Item spreadsheet (per branch) with a
 * "Merk" column pre-filled wherever a known brand token is confidently found
 * in the item name — a starting point to bulk-fill Item.brand, not a final
 * answer. Nothing is written to the database; this only reads the catalog
 * and writes local .xlsx files for you to review, correct, and then upload
 * back through Settings → Master Item (per cabang).
 *
 * The brand dictionary below is a best-effort starter list built from real
 * item names seen in this catalog (Petshop, Aksesoris HP, Voucher/SP) — it
 * is NOT exhaustive. Rows where nothing matched are left blank on purpose
 * (better blank than a wrong guess) — fill those in by hand in the output
 * file, or add more tokens to KNOWN_BRANDS below and re-run.
 *
 *   npx tsx scripts/suggest-item-brands.ts
 *
 * Writes: scripts-output/master-item-merk-BANDUNG.xlsx
 *         scripts-output/master-item-merk-CIMAHI.xlsx
 */
import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";

// Longest token wins when several match (e.g. prefer "CAT CHOIZE" over a
// hypothetical bare "CAT") — same longest-match-wins convention as ItemPoint
// patterns elsewhere in this app. Match is case-insensitive, whole-word-ish
// (token must appear as its own word, not as a substring of another word).
const KNOWN_BRANDS = [
  // Petshop
  "CAT CHOIZE", "CAT LEZATO", "LIFE CAT", "CATTIE CARE", "CRYSTAL KITTY",
  "FURLOVE", "BOLT", "KUCINGKU", "CHESTER", "CUTIES", "CUTTIES", "EXCEL",
  "FELIBITE", "LUMINA", "WHISKAS", "LIEBAO", "BEAUTY",
  // Aksesoris HP
  "ROBOT", "UFONE", "VIVAN", "MINIMO", "REXI", "RAPA", "UI ME",
  // Voucher / SP (provider, treated the same as a "brand" for filtering)
  "TELKOMSEL", "INDOSAT", "SMARTFREN", "SMART", "AXIS", "TRI", "XL",
].sort((a, b) => b.length - a.length); // longest first

function suggestBrand(name: string): string | null {
  const upper = name.toUpperCase();
  for (const brand of KNOWN_BRANDS) {
    const re = new RegExp(`(^|[^A-Z0-9])${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Z0-9]|$)`);
    if (re.test(upper)) return brand;
  }
  return null;
}

async function main() {
  const outDir = path.resolve(process.cwd(), "scripts-output");
  fs.mkdirSync(outDir, { recursive: true });

  for (const branch of ["BANDUNG", "CIMAHI"] as const) {
    const items = await prisma.item.findMany({
      where: { branch },
      select: { code: true, name: true, itemGroup: true, brand: true },
      orderBy: { name: "asc" },
    });

    let alreadySet = 0;
    let suggested = 0;
    let blank = 0;

    const rows = items.map((i) => {
      let merk = i.brand ?? "";
      if (i.brand) {
        alreadySet++;
      } else {
        const guess = suggestBrand(i.name);
        if (guess) {
          merk = guess;
          suggested++;
        } else {
          blank++;
        }
      }
      return {
        "Kode Item": i.code,
        "Nama Item": i.name,
        "Item Grup": i.itemGroup ?? "",
        Merk: merk,
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 12 }, { wch: 45 }, { wch: 20 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Table List");
    const outPath = path.join(outDir, `master-item-merk-${branch}.xlsx`);
    XLSX.writeFile(wb, outPath);

    console.log(
      `[${branch}] ${items.length} item — ${alreadySet} sudah punya merk, ` +
        `${suggested} disarankan otomatis, ${blank} masih kosong (perlu diisi manual). ` +
        `Ditulis ke ${outPath}`
    );
  }

  console.log(
    "\nCatatan: yang kosong biasanya kategori ACC CAMPURAN LAMA (casing per model HP) dan ATK — " +
      "konsepnya bukan \"merk aksesoris\" yang jelas, jadi sengaja tidak ditebak. " +
      "Isi manual kalau memang relevan, atau biarkan kosong (item itu cuma tidak akan muncul saat filter Merk dipakai)."
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
