import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  assertPlainObjectArray,
  restoreDataBackup,
  restoreSettingsBackup,
  BackupError,
} from "./backup";
import { deleteCustomRole, RoleError } from "./queries/roles";
import { prisma } from "./prisma";

const mockTx = {
  pointsExclusion: { deleteMany: vi.fn(), createMany: vi.fn() },
  outletAlias: { deleteMany: vi.fn(), createMany: vi.fn() },
  target: { deleteMany: vi.fn(), createMany: vi.fn() },
  itemGroupMapping: { deleteMany: vi.fn(), createMany: vi.fn() },
  pointGroupMapping: { deleteMany: vi.fn(), createMany: vi.fn() },
  itemPoint: { deleteMany: vi.fn(), createMany: vi.fn() },
  itemPointExclusion: { deleteMany: vi.fn(), createMany: vi.fn() },
  itemGroupPointDefault: { deleteMany: vi.fn(), createMany: vi.fn() },
  pointSettings: { deleteMany: vi.fn(), createMany: vi.fn() },
  customRole: { deleteMany: vi.fn(), createMany: vi.fn() },
  user: { findMany: vi.fn(), update: vi.fn() },
  session: { updateMany: vi.fn() },
};

vi.mock("./prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (fn: any) => fn(mockTx)),
    $executeRawUnsafe: vi.fn().mockResolvedValue(0),
    customRole: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      count: vi.fn(),
    },
  },
}));

vi.mock("./session", () => ({}));
vi.mock("./ensureDefaults", () => ({ ensureDefaults: vi.fn() }));

describe("backup validation & RBAC fail-closed guarantees", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("strips prototype-pollution keys and rejects non-object backup rows", () => {
    const poisoned = JSON.parse(
      '[{"id":1,"name":"Outlet A","__proto__":{"polluted":true},"constructor":"x","prototype":"y"}]',
    );
    const cleaned = assertPlainObjectArray(poisoned, "outlets");
    expect(cleaned).toHaveLength(1);
    expect(cleaned[0].name).toBe("Outlet A");
    expect(Object.prototype.hasOwnProperty.call(cleaned[0], "__proto__")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(cleaned[0], "constructor")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(cleaned[0], "prototype")).toBe(false);
    expect(({} as any).polluted).toBeUndefined();

    expect(() => assertPlainObjectArray("not-an-array", "outlets")).toThrow(BackupError);
    expect(() => assertPlainObjectArray([null], "outlets")).toThrow(BackupError);
  });

  it("rejects invalid payloads on restoreDataBackup before starting any transaction", async () => {
    await expect(restoreDataBackup({ kind: "wrong" })).rejects.toThrow(BackupError);
    await expect(
      restoreDataBackup({
        kind: "analisabee-data-backup",
        outlets: "invalid",
        employees: [],
        items: [],
        importBatches: [],
        sales: [],
      }),
    ).rejects.toThrow(BackupError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("preserves surviving roleId, deactivates orphan users, and revokes sessions in restoreSettingsBackup", async () => {
    mockTx.user.findMany.mockResolvedValueOnce([
      { id: 10, roleId: 1 },
      { id: 11, roleId: 99 }, // role 99 absent from restored backup
    ]);

    const res = await restoreSettingsBackup({
      kind: "analisabee-settings-backup",
      targets: [],
      outletAliases: [],
      itemGroupMappings: [],
      pointGroupMappings: [],
      itemPoints: [],
      itemPointExclusions: [],
      itemGroupPointDefaults: [],
      pointSettings: [],
      pointsExclusions: [],
      customRoles: [{ id: 1, name: "Kasir Bandung", permissions: ["dashboard"] }],
    });

    expect(res).toEqual({ deactivatedUsers: 1 });
    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { roleId: 1 },
    });
    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: { isActive: false, roleId: null },
    });
    expect(mockTx.session.updateMany).toHaveBeenCalledTimes(2);
  });

  it("blocks deleting a CustomRole while users remain assigned (fail-closed 409)", async () => {
    vi.mocked(prisma.customRole.findUnique).mockResolvedValueOnce({ id: 3 } as any);
    vi.mocked(prisma.user.count).mockResolvedValueOnce(2);

    try {
      await deleteCustomRole(3);
      throw new Error("expected RoleError to be thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(RoleError);
      expect((e as RoleError).status).toBe(409);
    }
    expect(prisma.customRole.delete).not.toHaveBeenCalled();
  });
});
