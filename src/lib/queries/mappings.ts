import { prisma } from "@/lib/prisma";
import { ensureDefaults } from "@/lib/ensureDefaults";
import type { ReportCategory } from "@/generated/prisma/client";

export async function listOutletAliases() {
  await ensureDefaults();
  return prisma.outletAlias.findMany({
    include: { outlet: { select: { id: true, name: true } } },
    orderBy: { alias: "asc" },
  });
}

export async function createOutletAlias(alias: string, outletId: number) {
  return prisma.outletAlias.upsert({
    where: { alias },
    update: { outletId, isDefault: false },
    create: { alias, outletId, isDefault: false },
  });
}

export async function deleteOutletAlias(id: number) {
  await prisma.outletAlias.delete({ where: { id } });
}

export async function listItemGroupMappings() {
  await ensureDefaults();
  return prisma.itemGroupMapping.findMany({ orderBy: { itemGroup: "asc" } });
}

export async function createItemGroupMapping(itemGroup: string, category: ReportCategory) {
  return prisma.itemGroupMapping.upsert({
    where: { itemGroup },
    update: { category, isDefault: false },
    create: { itemGroup, category, isDefault: false },
  });
}

export async function deleteItemGroupMapping(id: number) {
  await prisma.itemGroupMapping.delete({ where: { id } });
}
