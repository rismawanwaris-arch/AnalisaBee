import { prisma } from "@/lib/prisma";
import { DEFAULT_ALIAS_MAP } from "@/lib/defaults/outletAliases";
import { DEFAULT_GROUP_MAP } from "@/lib/defaults/itemGroupMapping";
import { DEFAULT_TARGETS } from "@/lib/defaults/targets";
import { DEFAULT_GROUP_POINTS, DEFAULT_ITEM_POINTS } from "@/lib/defaults/itemPoints";

/**
 * Idempotently seeds default targets, item-group mappings, outlet aliases,
 * and point rules. Cheap (a few dozen upserts) and safe to call on every load
 * of a page that needs them — self-heals a fresh database without a separate
 * seed step, and naturally catches up on aliases once outlets exist (they
 * don't until the first POS import, so this can't be a one-shot "seeded" flag).
 */
export async function ensureDefaults(): Promise<void> {
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
