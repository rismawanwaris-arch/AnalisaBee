/**
 * READ-ONLY check for a batch of "Nama Item, Point" pairs the owner wants to
 * add as ItemPoint rules — run BEFORE actually inserting anything via
 * Settings → Poin Penjualan.
 *
 * For each pasted name it checks, against the REAL current catalog and the
 * exact same case-insensitive substring rule the app uses at runtime
 * (computeItemPoints in src/lib/queries/points.ts):
 *   - does it match any real Item.name at all? (catches typos / items that
 *     don't exist in the catalog yet)
 *   - is there already an ItemPoint rule for this exact pattern, and if so
 *     does it already give the same points?
 *   - would a longer EXISTING pattern win over this one for the very same
 *     items (making the new rule a silent no-op)?
 *   - duplicate names within the pasted list itself
 *
 * Writes nothing. Run:
 *   npx tsx scripts/check-item-points.ts
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";

// Pasted directly from the owner's message.
const INPUT: [string, number][] = [
  ["FURLOVE CAN ALS CHICKEN IN JELLY 380 GR", 2],
  ["FURLOVE CAN ALS SALMON & CHICKEN IN JELLY 380G", 2],
  ["FURLOVE CAN ALS TUNA IN JELLY 380 GR", 2],
  ["FURLOVE CAN CRAB 380 GR", 2],
  ["FURLOVE CAN KITTEN SALMON IN JELLY 380 GR", 2],
  ["FURLOVE CAN KITTEN TUNA IN JELLY 380 GR", 2],
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

// Cheap similarity for "did they mean X" suggestions on zero-match rows:
// fraction of the shorter name's alnum tokens that also appear in the other.
function tokenOverlap(a: string, b: string): number {
  const ta = new Set(a.split(/[^A-Z0-9]+/).filter((t) => t.length >= 3));
  const tb = new Set(b.split(/[^A-Z0-9]+/).filter((t) => t.length >= 3));
  if (ta.size === 0 || tb.size === 0) return 0;
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit++;
  return hit / Math.min(ta.size, tb.size);
}

async function main() {
  const [items, existingRules, groupDefaults] = await Promise.all([
    prisma.item.findMany({ select: { id: true, name: true, itemGroup: true, branch: true, isHidden: true } }),
    prisma.itemPoint.findMany({ select: { pattern: true, points: true } }),
    prisma.itemGroupPointDefault.findMany({ select: { itemGroup: true, points: true } }),
  ]);

  console.log(`Katalog: ${items.length} item (semua cabang) — ${existingRules.length} rule ItemPoint sudah ada.\n`);

  // 1. Duplicates within the pasted list.
  const seen = new Map<string, number>();
  for (const [name] of INPUT) seen.set(norm(name), (seen.get(norm(name)) ?? 0) + 1);
  const dupes = [...seen.entries()].filter(([, n]) => n > 1);

  const noMatch: { name: string; points: number; suggestions: string[] }[] = [];
  const conflicts: { name: string; points: number; existing: number; matchCount: number }[] = [];
  const shadowed: { name: string; points: number; shadowBy: string; matchCount: number }[] = [];
  const ok: { name: string; points: number; matchCount: number; sample: string }[] = [];

  const rulesSortedByLen = [...existingRules].sort((a, b) => b.pattern.length - a.pattern.length);

  for (const [rawName, points] of INPUT) {
    const pattern = norm(rawName);
    const matches = items.filter((it) => norm(it.name).includes(pattern));

    if (matches.length === 0) {
      const suggestions = items
        .map((it) => ({ name: it.name, score: tokenOverlap(pattern, norm(it.name)) }))
        .filter((s) => s.score >= 0.6)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((s) => s.name);
      noMatch.push({ name: rawName, points, suggestions });
      continue;
    }

    // Does an ItemPoint rule for this exact pattern already exist?
    const exact = existingRules.find((r) => norm(r.pattern) === pattern);
    if (exact && exact.points !== points) {
      conflicts.push({ name: rawName, points, existing: exact.points, matchCount: matches.length });
      continue;
    }

    // Would some longer, already-existing pattern win for ALL the items this
    // new pattern would match — making the new rule dead on arrival?
    const longerWinner = rulesSortedByLen.find(
      (r) =>
        norm(r.pattern).length > pattern.length &&
        matches.every((it) => norm(it.name).includes(norm(r.pattern)))
    );
    if (longerWinner && (!exact || exact.points === points)) {
      shadowed.push({ name: rawName, points, shadowBy: longerWinner.pattern, matchCount: matches.length });
      continue;
    }

    ok.push({ name: rawName, points, matchCount: matches.length, sample: matches[0].name });
  }

  const line = (s = "") => console.log(s);
  line("=".repeat(78));
  line(`❌ TIDAK COCOK dengan item apa pun di katalog (${noMatch.length})`);
  line("   -> nama ini kemungkinan salah ketik, atau item belum ada di Master Item.");
  line("=".repeat(78));
  for (const r of noMatch) {
    line(`  "${r.name}"  (${r.points} poin)`);
    if (r.suggestions.length) line(`      mungkin maksudnya: ${r.suggestions.map((s) => `"${s}"`).join(" / ")}`);
  }

  line();
  line("=".repeat(78));
  line(`⚠️  SUDAH ADA RULE dengan poin BERBEDA (${conflicts.length})`);
  line("   -> perlu diputuskan: update ke poin baru, atau biarkan yang lama.");
  line("=".repeat(78));
  for (const r of conflicts) {
    line(`  "${r.name}"  poin lama=${r.existing} -> poin baru=${r.points}  (cocok ${r.matchCount} item)`);
  }

  line();
  line("=".repeat(78));
  line(`⚠️  AKAN TERTUTUP rule lain yang lebih panjang/spesifik (${shadowed.length})`);
  line('   -> rule ini akan MASUK tapi tidak pernah dipakai (kalah oleh rule yg sudah ada).');
  line("=".repeat(78));
  for (const r of shadowed) {
    line(`  "${r.name}"  (${r.points} poin) ditutupi oleh rule yang sudah ada: "${r.shadowBy}"`);
  }

  line();
  line("=".repeat(78));
  line(`⚠️  NAMA DUPLIKAT di daftar yang dikirim (${dupes.length})`);
  line("=".repeat(78));
  for (const [name, n] of dupes) line(`  "${name}"  muncul ${n}x`);

  line();
  line("=".repeat(78));
  line(`✅ AMAN diinput apa adanya (${ok.length} dari ${INPUT.length})`);
  line("=".repeat(78));
  for (const r of ok) line(`  "${r.name}"  ${r.points} poin — cocok ${r.matchCount} item, contoh: "${r.sample}"`);

  line();
  line(
    `Ringkasan: ${INPUT.length} baris input | ${ok.length} aman | ${noMatch.length} tidak cocok | ` +
      `${conflicts.length} konflik poin | ${shadowed.length} akan tertutup | ${dupes.length} duplikat nama`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
