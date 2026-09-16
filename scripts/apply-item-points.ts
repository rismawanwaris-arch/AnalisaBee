/**
 * Inserts the 97 Petshop ItemPoint rules the owner supplied (checked clean
 * by scripts/check-item-points.ts on 2026-09-16 — every name matched a real
 * catalog item, no conflicts, no rule shadowed another).
 *
 * SAFE BY DEFAULT: prints a full dry-run report and writes nothing. Re-check
 * live against whatever database DATABASE_URL points at (catalog may have
 * changed since the original check), then pass --apply to actually insert.
 *
 *   npx tsx scripts/apply-item-points.ts            # dry run (report only)
 *   npx tsx scripts/apply-item-points.ts --apply    # actually insert
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");

// 97 rows — the one literal duplicate in the owner's original 98-row paste
// ("FURLOVE CAN KITTEN TUNA IN JELLY 380 GR" appeared twice) is already
// removed.
const INPUT: [string, number][] = [
  ["FURLOVE CAN ALS CHICKEN IN JELLY 380 GR", 2],
  ["FURLOVE CAN ALS SALMON & CHICKEN IN JELLY 380G", 2],
  ["FURLOVE CAN ALS TUNA IN JELLY 380 GR", 2],
  ["FURLOVE CAN CRAB 380 GR", 2],
  ["FURLOVE CAN KITTEN SALMON IN JELLY 380 GR", 2],
  ["FURLOVE CAN KITTEN TUNA IN JELLY 380 GR", 2],
  ["FURLOVE CAN TUNA & CHICKEN 380 GR", 2],
  ["FURLOVE CAN TUNA WHITEFISH 380GR", 2],
  ["FURLOVE POUCH CHICKEN IN JELLY 80 GR", 2],
  ["FURLOVE POUCH KITTEN SALMON IN JELLY 80 GR", 2],
  ["FURLOVE POUCH KITTEN TUNA IN JELLY 80 GR", 2],
  ["FURLOVE POUCH SALMON & CHICKEN 80 GR", 2],
  ["FURLOVE POUCH TUNA & CHICKEN 80 GR", 2],
  ["FURLOVE POUCH TUNA IN JELLY 80 GR", 2],
  ["BOLT ADULT SALMON 800 GR", 3],
  ["BOLT DONAT 800 GR", 3],
  ["BOLT IKAN 800 GR", 3],
  ["BOLT KITTEN SALMON 1KG", 3],
  ["BOLT MOTHER KITTEN SALMON 500 GR", 3],
  ["BOLT MOTHER KITTEN TUNA 500GR", 3],
  ["FURLOVE CAN KITTEN SALMON IN JELLY", 3],
  ["FURLOVE DRY ALS ADULT TUNA 1 KG", 3],
  ["FURLOVE DRY ALS KITTEN CHICKEN 1 KG", 3],
  ["FURLOVE DRY ALS KITTEN SALMON 1 KG", 3],
  ["KUCINGKU KITTEN SALMON 800GR", 3],
  ["KUCINGKU KITTEN TUNA 800GR", 3],
  ["ACC KALUNG PITA", 5],
  ["ACC SEROK CUTE", 5],
  ["ACC SEROK KEPALA KUCING", 5],
  ["ACC SHAMPO KUCING QUEENIE", 5],
  ["ACC SISIR KUTU KUCING", 5],
  ["ACC TEMPAT MAKAN SINGLE", 5],
  ["ACC TEMPAT PASIR KECIL", 5],
  ["BEAUTY CAT 1 KG REPACK", 5],
  ["BEAUTY PERSIAN 750 GR", 5],
  ["CAT CHOIZE ADULT SALMON 800GR (ORANGE)", 5],
  ["CAT CHOIZE ADULT TUNA 800 GR (IJO)", 5],
  ["CAT CHOIZE KITTEN SALMON 1 KG (KUNING)", 5],
  ["CAT CHOIZE KITTEN TUNA 1 KG (PINK)", 5],
  ["CAT CHOIZE MOTHER&KITTEN 800 GR (PINK)", 5],
  ["CAT LEZATO 1 KG", 5],
  ["CAT LEZATO KITTEN 800 GR", 5],
  ["CAT LEZATO SALMON 1 KG", 5],
  ["CAT LEZATO TUNA 1 KG", 5],
  ["CATTIE CARE 800 GR", 5],
  ["CHESTER 1 KG", 5],
  ["CHESTER 800GR", 5],
  ["CRYSTAL KITTY CHICKEN SALMON 400 GR", 5],
  ["CRYSTAL KITTY HAIR AND SKIN 400GR", 5],
  ["CRYSTAL KITTY OCEAN FISH 400 GR", 5],
  ["CRYSTAL KITTY TUNA 400 GR", 5],
  ["CRYSTAL KITTY TUNA CHICKEN 400 GR", 5],
  ["CUTIES 1 KG TUNA", 5],
  ["CUTTIES 1KG REPACK", 5],
  ["EXCEL CHICKEN TUNA 500 GR", 5],
  ["EXCEL DONAT 500 GR", 5],
  ["EXCEL IKAN 500 GR", 5],
  ["EXCEL MOTHER KITTEN 500GR", 5],
  ["FELIBITE DONAT 500 GR", 5],
  ["FELIBITE IKAN 500 GR", 5],
  ["FELIBITE TUNA OTORO 500 GR", 5],
  ["FURLOVE DRY ALS KITTEN TUNA 1 KG", 5],
  ["HEALTY EYES", 5],
  ["LIFE CAT CAN ADULT 400 GR", 5],
  ["LUMINA CAN TUNA & CHICKEN", 5],
  ["PASIR IMPORT 5L LUMINA", 5],
  ["PASIR MIGOO 5L", 5],
  ["PASIR ROYAL PUSS 5L", 5],
  ["PASIR WANGI CUB N KIT 5L", 5],
  ["SALEP DARMA", 5],
  ["SALEP SCABIES", 5],
  ["ACC GUNTING KUKU KUCING", 10],
  ["ACC KALUNG KUCING", 10],
  ["ACC KANDANG KUCING", 10],
  ["ACC MAINAN TANGKAI", 10],
  ["ACC TEMPAT MAKAN DOUBLE", 10],
  ["BIOPRO PENGHILANG BAU", 10],
  ["LIFE CAT DRY 20 KG", 10],
  ["OBAT METRONIDAZOLE DIARHEA", 10],
  ["PASIR FORCATS 10 L", 10],
  ["PASIR IMPORT 10L LUMINA", 10],
  ["PASIR IMPORT LUMINA 5L", 10],
  ["PASIR KUCINGKU 10L", 10],
  ["PASIR KUCINGKU 6 KG + 300 GR", 10],
  ["PASIR LOVIE CAT 10L", 10],
  ["PASIR MAXLIFE 5L", 10],
  ["PASIR TOP 10L", 10],
  ["PASIR TOP 25 L", 10],
  ["PASIR TOTO 10L", 10],
  ["PASIR TOTO 5L", 10],
  ["PASIR WANGI FORTUNE 25 L", 10],
  ["ACC CARGO", 20],
  ["ACC KANDANG RIO KECIL", 20],
  ["ACC SANGKAR BURUNG BAMBU WARNA", 20],
  ["ACC KANDANG HAMSTER HC65", 30],
  ["ACC KANDANG KUCING 40X60", 30],
  ["ACC KANDANG KUCING LIAR 60CM", 30],
];

function norm(s: string): string {
  return s.trim().toUpperCase().replace(/\s+/g, " ");
}

async function main() {
  // Guard against a stray duplicate in INPUT itself (e.g. if this file gets
  // hand-edited later) — @unique on ItemPoint.pattern would only catch it at
  // insert time, one row at a time, which is a worse way to find out.
  const seen = new Set<string>();
  const inputDupes: string[] = [];
  for (const [name] of INPUT) {
    const key = norm(name);
    if (seen.has(key)) inputDupes.push(name);
    seen.add(key);
  }
  if (inputDupes.length > 0) {
    console.error(`❌ INPUT punya duplikat, perbaiki dulu: ${inputDupes.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  const [items, existingRules] = await Promise.all([
    prisma.item.findMany({ select: { name: true } }),
    prisma.itemPoint.findMany({ select: { pattern: true, points: true } }),
  ]);
  const existingByPattern = new Map(existingRules.map((r) => [norm(r.pattern), r]));

  const toCreate: { pattern: string; points: number }[] = [];
  const skipExists: { pattern: string; points: number; existingPoints: number }[] = [];
  const zeroMatchWarnings: string[] = [];

  for (const [pattern, points] of INPUT) {
    const existing = existingByPattern.get(norm(pattern));
    if (existing) {
      skipExists.push({ pattern, points, existingPoints: existing.points });
      continue;
    }
    const matchCount = items.filter((it) => norm(it.name).includes(norm(pattern))).length;
    if (matchCount === 0) {
      zeroMatchWarnings.push(pattern);
    }
    toCreate.push({ pattern, points });
  }

  console.log(`Katalog saat ini: ${items.length} item | rule ItemPoint sudah ada: ${existingRules.length}\n`);

  if (skipExists.length > 0) {
    console.log(`⚠️  ${skipExists.length} pattern SUDAH ADA di database — akan DILEWATI (tidak ditimpa):`);
    for (const r of skipExists) {
      const note = r.existingPoints === r.points ? "(poin sama, aman diabaikan)" : `(!) poin lama=${r.existingPoints}, poin baru diminta=${r.points} — TIDAK diubah otomatis`;
      console.log(`   "${r.pattern}"  ${note}`);
    }
    console.log();
  }

  if (zeroMatchWarnings.length > 0) {
    console.log(`⚠️  ${zeroMatchWarnings.length} pattern TIDAK cocok item apa pun di katalog SAAT INI (akan tetap dibuat — mungkin untuk item baru):`);
    for (const p of zeroMatchWarnings) console.log(`   "${p}"`);
    console.log();
  }

  console.log(`${APPLY ? "MENULIS" : "AKAN MENULIS (dry run)"} ${toCreate.length} rule ItemPoint baru:`);
  for (const r of toCreate) console.log(`   "${r.pattern}"  ->  ${r.points} poin`);

  if (!APPLY) {
    console.log(`\nIni baru simulasi — belum ada yang ditulis ke database.`);
    console.log(`Jalankan ulang dengan --apply untuk benar-benar insert ${toCreate.length} rule di atas.`);
    return;
  }

  console.log(`\n▶ Menulis ${toCreate.length} rule...`);
  const result = await prisma.itemPoint.createMany({
    data: toCreate.map((r) => ({ pattern: r.pattern, points: r.points })),
    skipDuplicates: true,
  });
  console.log(`✅ Selesai — ${result.count} rule berhasil diinput.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
