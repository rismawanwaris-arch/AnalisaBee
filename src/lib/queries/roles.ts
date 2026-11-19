import { prisma } from "../prisma";
import { FEATURE_KEYS, type FeatureKey } from "../features";

export class RoleError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function normalizeName(raw: unknown): string {
  const name = String(raw ?? "").trim();
  if (name.length < 2 || name.length > 40) {
    throw new RoleError("Nama peran harus 2–40 karakter.");
  }
  return name;
}

function normalizePermissions(raw: unknown): FeatureKey[] {
  if (!Array.isArray(raw)) throw new RoleError("Daftar fitur tidak valid.");
  const valid = new Set<string>(FEATURE_KEYS);
  const cleaned = [...new Set(raw.map((v) => String(v)))].filter((v) => valid.has(v));
  return cleaned as FeatureKey[];
}

const WITH_USER_COUNT = {
  id: true,
  name: true,
  permissions: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { users: true } },
} as const;

export async function listCustomRoles() {
  const roles = await prisma.customRole.findMany({
    select: WITH_USER_COUNT,
    orderBy: { name: "asc" },
  });
  return roles.map((r) => ({ ...r, userCount: r._count.users, _count: undefined }));
}

export async function createCustomRole(input: { name: unknown; permissions: unknown }) {
  const name = normalizeName(input.name);
  const permissions = normalizePermissions(input.permissions);

  const existing = await prisma.customRole.findUnique({ where: { name }, select: { id: true } });
  if (existing) throw new RoleError("Nama peran sudah dipakai.", 409);

  const role = await prisma.customRole.create({
    data: { name, permissions },
    select: WITH_USER_COUNT,
  });
  return { ...role, userCount: role._count.users, _count: undefined };
}

export async function updateCustomRole(
  id: number,
  input: { name?: unknown; permissions?: unknown },
) {
  const data: { name?: string; permissions?: FeatureKey[] } = {};
  if (input.name !== undefined) data.name = normalizeName(input.name);
  if (input.permissions !== undefined) data.permissions = normalizePermissions(input.permissions);

  if (data.name) {
    const existing = await prisma.customRole.findFirst({
      where: { name: data.name, id: { not: id } },
      select: { id: true },
    });
    if (existing) throw new RoleError("Nama peran sudah dipakai.", 409);
  }

  try {
    const role = await prisma.customRole.update({
      where: { id },
      data,
      select: WITH_USER_COUNT,
    });
    return { ...role, userCount: role._count.users, _count: undefined };
  } catch {
    throw new RoleError("Peran tidak ditemukan.", 404);
  }
}

/** Fail-closed: refuse deleting a role that is still assigned to accounts
 *  so those accounts never silently escalate back to full admin access. */
export async function deleteCustomRole(id: number) {
  const existing = await prisma.customRole.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new RoleError("Peran tidak ditemukan.", 404);

  const assigned = await prisma.user.count({ where: { roleId: id } });
  if (assigned > 0) {
    throw new RoleError(
      `Peran masih dipakai oleh ${assigned} akun. Pindahkan atau nonaktifkan akun tersebut terlebih dahulu sebelum menghapus peran.`,
      409,
    );
  }

  await prisma.customRole.delete({ where: { id } });
}
