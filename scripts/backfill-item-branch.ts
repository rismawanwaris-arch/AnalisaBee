/**
 * One-time backfill: reassigns Sale.itemId for sales that got linked to the
 * wrong branch's Item row before Item was branch-scoped (migration
 * 20260912100000_item_master_per_cabang). Before that migration, Item.code
 * was globally unique, so importing Cimahi after Bandung (or vice versa)
 * silently reused whichever branch's item got created first for a colliding
 * code — the sale's itemId still points at the RIGHT code, just possibly the
 * WRONG branch's row for that code.
 *
 * This script uses ImportBatch.branch — set once at import time and never
 * mutated afterward — as the ground truth for each sale's real branch, and
 * relinks it to the correct (code, branch) Item row.
 *
 * Run the Master Item import for BOTH branches (Settings → Master Item per
 * Cabang) before running this — sales whose target item doesn't exist yet in
 * the destination branch are reported and skipped, not guessed at.
 *
 * SAFE BY DEFAULT: prints a full report and writes nothing. Pass --apply to
 * commit after reviewing the dry-run output.
 *
 *   tsx scripts/backfill-item-branch.ts            # dry run (report only)
 *   tsx scripts/backfill-item-branch.ts --apply    # actually reassign
 */
import "dotenv/config";
import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");

interface Group {
  code: string;
  trueBranch: "BANDUNG" | "CIMAHI";
  saleIds: number[];
}

async function main() {
  const sales = await prisma.sale.findMany({
    select: {
      id: true,
      item: { select: { code: true, branch: true } },
      import: { select: { branch: true } },
    },
  });

  const groups = new Map<string, Group>();
  for (const s of sales) {
    const trueBranch = s.import.branch;
    if (s.item.branch === trueBranch) continue; // already correct, nothing to do
    const key = `${s.item.code}::${trueBranch}`;
    let g = groups.get(key);
    if (!g) {
      g = { code: s.item.code, trueBranch, saleIds: [] };
      groups.set(key, g);
    }
    g.saleIds.push(s.id);
  }

  if (groups.size === 0) {
    console.log("Tidak ada sale yang salah tautan cabang. Tidak ada yang perlu diperbaiki.");
    return;
  }

  const totalSales = [...groups.values()].reduce((a, g) => a + g.saleIds.length, 0);
  console.log(
    `Ditemukan ${groups.size} kombinasi (kode, cabang tujuan) yang salah tautan, memengaruhi ${totalSales} baris sale.\n`
  );

  let fixedGroups = 0;
  let skippedGroups = 0;

  for (const g of groups.values()) {
    const target = await prisma.item.findUnique({
      where: { code_branch: { code: g.code, branch: g.trueBranch } },
    });

    if (!target) {
      skippedGroups++;
      console.log(
        `SKIP  ${g.code} -> ${g.trueBranch}: item ini belum ada sama sekali di cabang tujuan (${g.saleIds.length} sale). Upload Master Item ${g.trueBranch} dulu, lalu jalankan ulang skrip ini.`
      );
      continue;
    }

    fixedGroups++;
    const flag = target.isFromSalesImport ? " [BELUM DI MASTER]" : "";
    console.log(`OK    ${g.code} -> ${g.trueBranch}: "${target.name}"${flag} (${g.saleIds.length} sale)`);

    if (APPLY) {
      await prisma.sale.updateMany({
        where: { id: { in: g.saleIds } },
        data: { itemId: target.id },
      });
    }
  }

  console.log(
    `\nRingkasan: ${fixedGroups} kombinasi ${APPLY ? "diperbaiki" : "siap diperbaiki"}, ${skippedGroups} dilewati (item tujuan belum ada).`
  );
  if (!APPLY) {
    console.log("Ini baru simulasi — tidak ada data yang ditulis. Jalankan lagi dengan --apply untuk menyimpan perubahan.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
