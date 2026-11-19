import { prisma } from "./prisma";

export class BackupError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const DATA_BACKUP_KIND = "analisabee-data-backup";
const SETTINGS_BACKUP_KIND = "analisabee-settings-backup";
const BACKUP_VERSION = 1;

// Bulk-insert in chunks so one giant createMany doesn't blow past Postgres'
// parameter limit (65535 bind params per statement) once Sale history grows.
const CHUNK_SIZE = 2000;

async function insertChunked<T>(
  rows: T[],
  fn: (chunk: T[]) => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    await fn(rows.slice(i, i + CHUNK_SIZE));
  }
}

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/** Validates that a backup section is an array of plain objects and strips
 *  prototype-pollution keys before forwarding records to Prisma. */
export function assertPlainObjectArray(arr: unknown, label: string): Record<string, any>[] {
  if (!Array.isArray(arr)) {
    throw new BackupError(`Struktur file backup tidak valid pada bagian "${label}".`);
  }
  return arr.map((item, idx) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new BackupError(`Baris ke-${idx + 1} pada bagian "${label}" bukan objek valid.`);
    }
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(item)) {
      if (DANGEROUS_KEYS.has(k)) continue;
      clean[k] = v;
    }
    return clean;
  });
}

// Every table this module ever calls resetSequence() with — kept here as a
// hard allowlist so the function is safe by construction, not just safe
// because every current caller happens to pass a hardcoded string. $executeRawUnsafe
// can't parameterize an identifier, so this check is what stands between a
// stray dynamic value and SQL injection if a future change ever wires one in.
const RESETTABLE_TABLES = new Set([
  "outlets",
  "employees",
  "items",
  "import_batches",
  "sales",
  "tartun_daily",
  "server_daily",
  "purchase_batches",
  "purchase_invoices",
  "purchase_items",
  "sp_point_batches",
  "sp_activation_points",
  "attention_programs",
  "attention_point_entries",
  "targets",
  "outlet_aliases",
  "item_group_mappings",
  "point_group_mappings",
  "item_points",
  "item_point_exclusions",
  "item_group_point_defaults",
  "points_exclusions",
  "custom_roles",
]);

async function resetSequence(table: string): Promise<void> {
  if (!RESETTABLE_TABLES.has(table)) {
    throw new BackupError(`Tabel tidak dikenal untuk reset sequence: ${table}`, 500);
  }
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1), (SELECT MAX(id) IS NOT NULL FROM "${table}"))`,
  );
}

// ==========================================
// DATA IMPORT BACKUP
// ==========================================

export async function exportDataBackup() {
  const [
    outlets,
    employees,
    items,
    importBatches,
    sales,
    tartunDaily,
    serverDaily,
    purchaseBatches,
    purchaseInvoices,
    purchaseItems,
    spPointBatches,
    spActivationPoints,
    attentionPrograms,
    attentionPointEntries,
  ] = await Promise.all([
    prisma.outlet.findMany(),
    prisma.employee.findMany(),
    prisma.item.findMany(),
    prisma.importBatch.findMany(),
    prisma.sale.findMany(),
    prisma.tartunDaily.findMany(),
    prisma.serverDaily.findMany(),
    prisma.purchaseBatch.findMany(),
    prisma.purchaseInvoice.findMany(),
    prisma.purchaseItem.findMany(),
    prisma.spPointBatch.findMany(),
    prisma.spActivationPoint.findMany(),
    prisma.attentionProgram.findMany(),
    prisma.attentionPointEntry.findMany(),
  ]);

  return {
    kind: DATA_BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    counts: {
      outlets: outlets.length,
      employees: employees.length,
      items: items.length,
      importBatches: importBatches.length,
      sales: sales.length,
      tartunDaily: tartunDaily.length,
      serverDaily: serverDaily.length,
      purchaseBatches: purchaseBatches.length,
      purchaseInvoices: purchaseInvoices.length,
      purchaseItems: purchaseItems.length,
      spPointBatches: spPointBatches.length,
      spActivationPoints: spActivationPoints.length,
      attentionPrograms: attentionPrograms.length,
      attentionPointEntries: attentionPointEntries.length,
    },
    outlets,
    employees,
    items,
    importBatches,
    sales,
    tartunDaily,
    serverDaily,
    purchaseBatches,
    purchaseInvoices,
    purchaseItems,
    spPointBatches,
    spActivationPoints,
    attentionPrograms,
    attentionPointEntries,
  };
}

export interface DataRestoreResult {
  skippedAliases: number;
  skippedPointsExclusions: number;
}

export async function restoreDataBackup(payload: any): Promise<DataRestoreResult> {
  if (!payload || payload.kind !== DATA_BACKUP_KIND) {
    throw new BackupError("File ini bukan backup Data Import yang valid.");
  }
  const outlets = assertPlainObjectArray(payload.outlets, "outlets");
  const employees = assertPlainObjectArray(payload.employees, "employees");
  const items = assertPlainObjectArray(payload.items, "items");
  const importBatches = assertPlainObjectArray(payload.importBatches, "importBatches");
  const sales = assertPlainObjectArray(payload.sales, "sales");
  const tartunDaily = assertPlainObjectArray(payload.tartunDaily, "tartunDaily");
  const serverDaily = assertPlainObjectArray(payload.serverDaily, "serverDaily");
  const purchaseBatches = Array.isArray(payload.purchaseBatches)
    ? assertPlainObjectArray(payload.purchaseBatches, "purchaseBatches")
    : [];
  const purchaseInvoices = Array.isArray(payload.purchaseInvoices)
    ? assertPlainObjectArray(payload.purchaseInvoices, "purchaseInvoices")
    : [];
  const purchaseItems = Array.isArray(payload.purchaseItems)
    ? assertPlainObjectArray(payload.purchaseItems, "purchaseItems")
    : [];
  const spPointBatches = Array.isArray(payload.spPointBatches)
    ? assertPlainObjectArray(payload.spPointBatches, "spPointBatches")
    : [];
  const spActivationPoints = Array.isArray(payload.spActivationPoints)
    ? assertPlainObjectArray(payload.spActivationPoints, "spActivationPoints")
    : [];
  const attentionPrograms = Array.isArray(payload.attentionPrograms)
    ? assertPlainObjectArray(payload.attentionPrograms, "attentionPrograms")
    : [];
  const attentionPointEntries = Array.isArray(payload.attentionPointEntries)
    ? assertPlainObjectArray(payload.attentionPointEntries, "attentionPointEntries")
    : [];

  let skippedAliases = 0;
  let skippedPointsExclusions = 0;

  try {
    await prisma.$transaction(
      async (tx) => {
        // OutletAlias (Outlet) and PointsExclusion (Employee) live in the
        // Pengaturan scope but carry a hard FK into this scope's tables, so
        // wiping Outlet/Employee here would violate that constraint. Lift
        // them out, restore this scope, then put back only the rows whose
        // referenced outlet/employee still exists in the restored data.
        const existingAliases = await tx.outletAlias.findMany();
        const existingExclusions = await tx.pointsExclusion.findMany();
        await tx.outletAlias.deleteMany();
        await tx.pointsExclusion.deleteMany();

        // Children first (respecting RESTRICT/CASCADE FKs on Employee, Outlet, Sale, etc.).
        await tx.attentionPointEntry.deleteMany();
        await tx.attentionProgram.deleteMany();
        await tx.spActivationPoint.deleteMany();
        await tx.spPointBatch.deleteMany();
        await tx.purchaseItem.deleteMany();
        await tx.purchaseInvoice.deleteMany();
        await tx.purchaseBatch.deleteMany();
        await tx.sale.deleteMany();
        await tx.tartunDaily.deleteMany();
        await tx.serverDaily.deleteMany();
        await tx.importBatch.deleteMany();
        await tx.outlet.deleteMany();
        await tx.employee.deleteMany();
        await tx.item.deleteMany();

        // Parents first, on the way back in.
        if (outlets.length) await insertChunked(outlets, (c) => tx.outlet.createMany({ data: c as any }));
        if (employees.length) await insertChunked(employees, (c) => tx.employee.createMany({ data: c as any }));
        if (items.length) await insertChunked(items, (c) => tx.item.createMany({ data: c as any }));
        if (importBatches.length) await insertChunked(importBatches, (c) => tx.importBatch.createMany({ data: c as any }));
        if (sales.length) await insertChunked(sales, (c) => tx.sale.createMany({ data: c as any }));
        if (tartunDaily.length) await insertChunked(tartunDaily, (c) => tx.tartunDaily.createMany({ data: c as any }));
        if (serverDaily.length) await insertChunked(serverDaily, (c) => tx.serverDaily.createMany({ data: c as any }));

        if (purchaseBatches.length) await insertChunked(purchaseBatches, (c) => tx.purchaseBatch.createMany({ data: c as any }));
        if (purchaseInvoices.length) await insertChunked(purchaseInvoices, (c) => tx.purchaseInvoice.createMany({ data: c as any }));
        if (purchaseItems.length) await insertChunked(purchaseItems, (c) => tx.purchaseItem.createMany({ data: c as any }));
        if (spPointBatches.length) await insertChunked(spPointBatches, (c) => tx.spPointBatch.createMany({ data: c as any }));
        if (spActivationPoints.length) await insertChunked(spActivationPoints, (c) => tx.spActivationPoint.createMany({ data: c as any }));
        if (attentionPrograms.length) await insertChunked(attentionPrograms, (c) => tx.attentionProgram.createMany({ data: c as any }));
        if (attentionPointEntries.length) await insertChunked(attentionPointEntries, (c) => tx.attentionPointEntry.createMany({ data: c as any }));

        const restoredOutletIds = new Set(outlets.map((o) => o.id));
        const restoredEmployeeIds = new Set(employees.map((e) => e.id));
        const aliasesToRestore = existingAliases.filter((a) => restoredOutletIds.has(a.outletId));
        const exclusionsToRestore = existingExclusions.filter((p) => restoredEmployeeIds.has(p.employeeId));
        skippedAliases = existingAliases.length - aliasesToRestore.length;
        skippedPointsExclusions = existingExclusions.length - exclusionsToRestore.length;

        if (aliasesToRestore.length) await insertChunked(aliasesToRestore, (c) => tx.outletAlias.createMany({ data: c }));
        if (exclusionsToRestore.length) await insertChunked(exclusionsToRestore, (c) => tx.pointsExclusion.createMany({ data: c }));
      },
      { timeout: 5 * 60 * 1000, maxWait: 30 * 1000 },
    );

    for (const table of [
      "outlets",
      "employees",
      "items",
      "import_batches",
      "sales",
      "tartun_daily",
      "server_daily",
      "purchase_batches",
      "purchase_invoices",
      "purchase_items",
      "sp_point_batches",
      "sp_activation_points",
      "attention_programs",
      "attention_point_entries",
    ]) {
      await resetSequence(table);
    }

    return { skippedAliases, skippedPointsExclusions };
  } catch (err) {
    if (err instanceof BackupError) throw err;
    console.error("restoreDataBackup error:", err);
    const isDev = process.env.NODE_ENV !== "production";
    const detail = isDev && err instanceof Error ? ` Detail: ${err.message}` : "";
    throw new BackupError(
      `Gagal memulihkan data — kemungkinan ada data yang saling bertautan tidak cocok.${detail}`,
      500,
    );
  }
}

// ==========================================
// SETTINGS BACKUP (Target, mappings, points rules, custom roles)
// ==========================================

export async function exportSettingsBackup() {
  const [
    targets,
    outletAliases,
    itemGroupMappings,
    pointGroupMappings,
    itemPoints,
    itemPointExclusions,
    itemGroupPointDefaults,
    pointSettings,
    pointsExclusions,
    customRoles,
  ] = await Promise.all([
    prisma.target.findMany(),
    prisma.outletAlias.findMany(),
    prisma.itemGroupMapping.findMany(),
    prisma.pointGroupMapping.findMany(),
    prisma.itemPoint.findMany(),
    prisma.itemPointExclusion.findMany(),
    prisma.itemGroupPointDefault.findMany(),
    prisma.pointSettings.findMany(),
    prisma.pointsExclusion.findMany(),
    prisma.customRole.findMany(),
  ]);

  return {
    kind: SETTINGS_BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    counts: {
      targets: targets.length,
      outletAliases: outletAliases.length,
      itemGroupMappings: itemGroupMappings.length,
      pointGroupMappings: pointGroupMappings.length,
      itemPoints: itemPoints.length,
      itemPointExclusions: itemPointExclusions.length,
      itemGroupPointDefaults: itemGroupPointDefaults.length,
      pointsExclusions: pointsExclusions.length,
      customRoles: customRoles.length,
    },
    targets,
    outletAliases,
    itemGroupMappings,
    pointGroupMappings,
    itemPoints,
    itemPointExclusions,
    itemGroupPointDefaults,
    pointSettings,
    pointsExclusions,
    customRoles,
  };
}

export interface SettingsRestoreResult {
  deactivatedUsers: number;
}

export async function restoreSettingsBackup(payload: any): Promise<SettingsRestoreResult> {
  if (!payload || payload.kind !== SETTINGS_BACKUP_KIND) {
    throw new BackupError("File ini bukan backup Pengaturan yang valid.");
  }
  const targets = assertPlainObjectArray(payload.targets, "targets");
  const outletAliases = assertPlainObjectArray(payload.outletAliases, "outletAliases");
  const itemGroupMappings = assertPlainObjectArray(payload.itemGroupMappings, "itemGroupMappings");
  const pointGroupMappings = Array.isArray(payload.pointGroupMappings)
    ? assertPlainObjectArray(payload.pointGroupMappings, "pointGroupMappings")
    : itemGroupMappings;
  const itemPoints = assertPlainObjectArray(payload.itemPoints, "itemPoints");
  const itemPointExclusions = assertPlainObjectArray(payload.itemPointExclusions, "itemPointExclusions");
  const itemGroupPointDefaults = assertPlainObjectArray(payload.itemGroupPointDefaults, "itemGroupPointDefaults");
  const pointSettings = assertPlainObjectArray(payload.pointSettings, "pointSettings");
  const pointsExclusions = assertPlainObjectArray(payload.pointsExclusions, "pointsExclusions");
  const customRoles = assertPlainObjectArray(payload.customRoles, "customRoles");

  let deactivatedUsers = 0;

  try {
    await prisma.$transaction(
      async (tx) => {
        // Snapshot custom-role assignments BEFORE wiping customRoles (onDelete: SetNull
        // would otherwise clear roleId and silently promote restricted admins to "all").
        const existingUserRoles = await tx.user.findMany({
          where: { roleId: { not: null } },
          select: { id: true, roleId: true },
        });

        // Children first.
        await tx.pointsExclusion.deleteMany();
        await tx.outletAlias.deleteMany();
        await tx.target.deleteMany();
        await tx.itemGroupMapping.deleteMany();
        await tx.pointGroupMapping.deleteMany();
        await tx.itemPoint.deleteMany();
        await tx.itemPointExclusion.deleteMany();
        await tx.itemGroupPointDefault.deleteMany();
        await tx.pointSettings.deleteMany();
        await tx.customRole.deleteMany();

        if (customRoles.length) await insertChunked(customRoles, (c) => tx.customRole.createMany({ data: c as any }));
        if (targets.length) await insertChunked(targets, (c) => tx.target.createMany({ data: c as any }));
        if (itemGroupMappings.length) await insertChunked(itemGroupMappings, (c) => tx.itemGroupMapping.createMany({ data: c as any }));
        if (pointGroupMappings.length) await insertChunked(pointGroupMappings, (c) => tx.pointGroupMapping.createMany({ data: c as any }));
        if (itemPoints.length) await insertChunked(itemPoints, (c) => tx.itemPoint.createMany({ data: c as any }));
        if (itemPointExclusions.length) await insertChunked(itemPointExclusions, (c) => tx.itemPointExclusion.createMany({ data: c as any }));
        if (itemGroupPointDefaults.length) await insertChunked(itemGroupPointDefaults, (c) => tx.itemGroupPointDefault.createMany({ data: c as any }));
        if (pointSettings.length) await insertChunked(pointSettings, (c) => tx.pointSettings.createMany({ data: c as any }));
        if (outletAliases.length) await insertChunked(outletAliases, (c) => tx.outletAlias.createMany({ data: c as any }));
        if (pointsExclusions.length) await insertChunked(pointsExclusions, (c) => tx.pointsExclusion.createMany({ data: c as any }));

        // Restore roleId for surviving roles; fail-closed (deactivate) if a user's
        // custom role was absent from the restored backup, and revoke their sessions.
        const restoredRoleIds = new Set(customRoles.map((r) => Number(r.id)).filter(Number.isInteger));
        const now = new Date();
        for (const u of existingUserRoles) {
          if (u.roleId !== null && restoredRoleIds.has(u.roleId)) {
            await tx.user.update({ where: { id: u.id }, data: { roleId: u.roleId } });
          } else {
            await tx.user.update({ where: { id: u.id }, data: { isActive: false, roleId: null } });
            deactivatedUsers += 1;
          }
          await tx.session.updateMany({
            where: { userId: u.id, revokedAt: null },
            data: { revokedAt: now },
          });
        }
      },
      { timeout: 5 * 60 * 1000, maxWait: 30 * 1000 },
    );

    for (const table of [
      "targets",
      "outlet_aliases",
      "item_group_mappings",
      "point_group_mappings",
      "item_points",
      "item_point_exclusions",
      "item_group_point_defaults",
      "points_exclusions",
      "custom_roles",
    ]) {
      await resetSequence(table);
    }

    return { deactivatedUsers };
  } catch (err) {
    if (err instanceof BackupError) throw err;
    console.error("restoreSettingsBackup error:", err);
    const isDev = process.env.NODE_ENV !== "production";
    const detail = isDev && err instanceof Error ? ` Detail: ${err.message}` : "";
    throw new BackupError(
      `Gagal memulihkan pengaturan — kemungkinan ada referensi outlet/pegawai yang sudah tidak ada.${detail}`,
      500,
    );
  }
}
