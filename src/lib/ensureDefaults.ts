import { prisma } from "@/lib/prisma";
import { DEFAULT_ALIAS_MAP } from "@/lib/defaults/outletAliases";
import { DEFAULT_GROUP_MAP } from "@/lib/defaults/itemGroupMapping";
import { DEFAULT_TARGETS } from "@/lib/defaults/targets";
import { DEFAULT_GROUP_POINTS, DEFAULT_ITEM_POINTS } from "@/lib/defaults/itemPoints";

let _ensured = false;

/**
 * Idempotently seeds default targets, item-group mappings, outlet aliases,
 * and point rules. Safe to call repeatedly — only runs once per process
 * lifetime. Call invalidateDefaults() after a POS import so aliases for
 * newly-created outlets are seeded on the next request.
 */
export function invalidateDefaults() {
  _ensured = false;
}

export async function ensureDefaults(): Promise<void> {
  if (_ensured) return;
  _ensured = true;
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "outlets" ADD COLUMN IF NOT EXISTS "isHidden" BOOLEAN NOT NULL DEFAULT false;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "isHidden" BOOLEAN NOT NULL DEFAULT false;`);
  } catch {
    // ignore error if tables not yet created
  }

  await Promise.all(
    DEFAULT_TARGETS.map((t) =>
      prisma.target.upsert({
        where: { scope_category: { scope: t.scope, category: t.category } },
        update: {},
        create: { scope: t.scope, category: t.category, amount: t.amount },
      })
    )
  );

  await Promise.all(
    Object.entries(DEFAULT_GROUP_MAP).map(([itemGroup, category]) =>
      prisma.itemGroupMapping.upsert({
        where: { itemGroup },
        update: {},
        create: { itemGroup, category, isDefault: true },
      })
    )
  );

  const outletNames = [...new Set(Object.values(DEFAULT_ALIAS_MAP))];
  const outlets = await prisma.outlet.findMany({ where: { name: { in: outletNames } } });
  const outletIdByName = new Map(outlets.map((o) => [o.name, o.id]));

  await Promise.all(
    Object.entries(DEFAULT_ALIAS_MAP).map(([alias, outletName]) => {
      const outletId = outletIdByName.get(outletName);
      if (!outletId) return Promise.resolve();
      return prisma.outletAlias.upsert({
        where: { alias },
        update: {},
        create: { alias, outletId, isDefault: true },
      });
    })
  );

  await Promise.all(
    DEFAULT_ITEM_POINTS.map((p) =>
      prisma.itemPoint.upsert({
        where: { pattern: p.pattern },
        update: {},
        create: { pattern: p.pattern, points: p.points, isDefault: true },
      })
    )
  );

  await Promise.all(
    DEFAULT_GROUP_POINTS.map((g) =>
      prisma.itemGroupPointDefault.upsert({
        where: { itemGroup: g.itemGroup },
        update: {},
        create: { itemGroup: g.itemGroup, points: g.points },
      })
    )
  );
}
