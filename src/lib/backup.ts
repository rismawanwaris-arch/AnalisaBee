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

async function resetSequence(table: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1), (SELECT MAX(id) IS NOT NULL FROM "${table}"))`,
  );
}

// ==========================================
// DATA IMPORT BACKUP (Outlet, Employee, Item, ImportBatch, Sale, TartunDaily, ServerDaily)
// ==========================================

export async function exportDataBackup() {
  const [outlets, employees, items, importBatches, sales, tartunDaily, serverDaily] =
    await Promise.all([
      prisma.outlet.findMany(),
      prisma.employee.findMany(),
      prisma.item.findMany(),
      prisma.importBatch.findMany(),
      prisma.sale.findMany(),
      prisma.tartunDaily.findMany(),
      prisma.serverDaily.findMany(),
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
    },
    outlets,
    employees,
    items,
    importBatches,
    sales,
    tartunDaily,
    serverDaily,
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
  const outlets: any[] = payload.outlets;
  const employees: any[] = payload.employees;
  const items: any[] = payload.items;
  const importBatches: any[] = payload.importBatches;
  const sales: any[] = payload.sales;
  const tartunDaily: any[] = payload.tartunDaily;
  const serverDaily: any[] = payload.serverDaily;
  if (![outlets, employees, items, importBatches, sales, tartunDaily, serverDaily].every(Array.isArray)) {
    throw new BackupError("Struktur file backup tidak lengkap atau rusak.");
  }

  let skippedAliases = 0;
  let skippedPointsExclusions = 0;

  try {
    await prisma.$transaction(
      async (tx) => {
        // OutletAlias (Outlet) and PointsExclusion (Employee) live in the
        // Pengaturan scope but carry a hard FK into this scope's tables, so
        // wiping Outlet/Employee here would violate that constraint. Lift
        // them out, restore this scope, then put back only the rows whose
        // referenced outlet/employee still exists in the restored data —
        // anything else in this backup predates the row it pointed to.
        const existingAliases = await tx.outletAlias.findMany();
        const existingExclusions = await tx.pointsExclusion.findMany();
        await tx.outletAlias.deleteMany();
        await tx.pointsExclusion.deleteMany();

        // Children first.
        await tx.sale.deleteMany();
        await tx.tartunDaily.deleteMany();
        await tx.serverDaily.deleteMany();
        await tx.importBatch.deleteMany();
        await tx.outlet.deleteMany();
        await tx.employee.deleteMany();
        await tx.item.deleteMany();

        // Parents first, on the way back in.
        if (outlets.length) await insertChunked(outlets, (c) => tx.outlet.createMany({ data: c }));
        if (employees.length) await insertChunked(employees, (c) => tx.employee.createMany({ data: c }));
        if (items.length) await insertChunked(items, (c) => tx.item.createMany({ data: c }));
        if (importBatches.length) await insertChunked(importBatches, (c) => tx.importBatch.createMany({ data: c }));
        if (sales.length) await insertChunked(sales, (c) => tx.sale.createMany({ data: c }));
        if (tartunDaily.length) await insertChunked(tartunDaily, (c) => tx.tartunDaily.createMany({ data: c }));
        if (serverDaily.length) await insertChunked(serverDaily, (c) => tx.serverDaily.createMany({ data: c }));

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

    for (const table of ["outlets", "employees", "items", "import_batches", "sales", "tartun_daily", "server_daily"]) {
      await resetSequence(table);
    }

    return { skippedAliases, skippedPointsExclusions };
  } catch (err) {
    if (err instanceof BackupError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new BackupError(
      `Gagal memulihkan data — kemungkinan ada data yang saling bertautan tidak cocok. Detail: ${msg}`,
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
      itemPoints: itemPoints.length,
      itemPointExclusions: itemPointExclusions.length,
      itemGroupPointDefaults: itemGroupPointDefaults.length,
      pointsExclusions: pointsExclusions.length,
      customRoles: customRoles.length,
    },
    targets,
    outletAliases,
    itemGroupMappings,
    itemPoints,
    itemPointExclusions,
    itemGroupPointDefaults,
    pointSettings,
    pointsExclusions,
    customRoles,
  };
}

export async function restoreSettingsBackup(payload: any): Promise<void> {
  if (!payload || payload.kind !== SETTINGS_BACKUP_KIND) {
    throw new BackupError("File ini bukan backup Pengaturan yang valid.");
  }
  const targets: any[] = payload.targets;
  const outletAliases: any[] = payload.outletAliases;
  const itemGroupMappings: any[] = payload.itemGroupMappings;
  const itemPoints: any[] = payload.itemPoints;
  const itemPointExclusions: any[] = payload.itemPointExclusions;
  const itemGroupPointDefaults: any[] = payload.itemGroupPointDefaults;
  const pointSettings: any[] = payload.pointSettings;
  const pointsExclusions: any[] = payload.pointsExclusions;
  const customRoles: any[] = payload.customRoles;
  if (
    ![targets, outletAliases, itemGroupMappings, itemPoints, itemPointExclusions, itemGroupPointDefaults, pointSettings, pointsExclusions, customRoles].every(Array.isArray)
  ) {
    throw new BackupError("Struktur file backup tidak lengkap atau rusak.");
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        // Children first.
        await tx.pointsExclusion.deleteMany();
        await tx.outletAlias.deleteMany();
        await tx.target.deleteMany();
        await tx.itemGroupMapping.deleteMany();
        await tx.itemPoint.deleteMany();
        await tx.itemPointExclusion.deleteMany();
        await tx.itemGroupPointDefault.deleteMany();
        await tx.pointSettings.deleteMany();
        // Clearing custom_roles just detaches members (onDelete: SetNull on User.roleId).
        await tx.customRole.deleteMany();

        if (customRoles.length) await insertChunked(customRoles, (c) => tx.customRole.createMany({ data: c }));
        if (targets.length) await insertChunked(targets, (c) => tx.target.createMany({ data: c }));
        if (itemGroupMappings.length) await insertChunked(itemGroupMappings, (c) => tx.itemGroupMapping.createMany({ data: c }));
        if (itemPoints.length) await insertChunked(itemPoints, (c) => tx.itemPoint.createMany({ data: c }));
        if (itemPointExclusions.length) await insertChunked(itemPointExclusions, (c) => tx.itemPointExclusion.createMany({ data: c }));
        if (itemGroupPointDefaults.length) await insertChunked(itemGroupPointDefaults, (c) => tx.itemGroupPointDefault.createMany({ data: c }));
        if (pointSettings.length) await insertChunked(pointSettings, (c) => tx.pointSettings.createMany({ data: c }));
        if (outletAliases.length) await insertChunked(outletAliases, (c) => tx.outletAlias.createMany({ data: c }));
        if (pointsExclusions.length) await insertChunked(pointsExclusions, (c) => tx.pointsExclusion.createMany({ data: c }));
      },
      { timeout: 5 * 60 * 1000, maxWait: 30 * 1000 },
    );

    for (const table of ["targets", "outlet_aliases", "item_group_mappings", "item_points", "item_point_exclusions", "item_group_point_defaults", "points_exclusions", "custom_roles"]) {
      await resetSequence(table);
    }
  } catch (err) {
    if (err instanceof BackupError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new BackupError(
      `Gagal memulihkan pengaturan — kemungkinan ada referensi outlet/pegawai yang sudah tidak ada. Detail: ${msg}`,
      500,
    );
  }
}
