import { prisma } from "../prisma";
import { hashPassword, checkPasswordPolicy } from "../password";
import { revokeAllSessionsForUser, type UserRole } from "../session";

export class UserError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const USERNAME_RE = /^[a-z0-9](?:[a-z0-9_.-]{1,30}[a-z0-9])$/;

export function normalizeUsername(raw: unknown): string {
  const username = String(raw ?? "").trim().toLowerCase();
  if (!USERNAME_RE.test(username)) {
    throw new UserError(
      "Username harus 3–32 karakter, huruf kecil/angka, boleh mengandung . _ - di tengah.",
    );
  }
  return username;
}

function assertPassword(password: unknown): string {
  const value = String(password ?? "");
  const policy = checkPasswordPolicy(value);
  if (!policy.ok) throw new UserError(policy.error ?? "Kata sandi tidak memenuhi syarat.");
  return value;
}

function assertRole(role: unknown): UserRole {
  if (role !== "master" && role !== "admin") {
    throw new UserError("Role harus 'master' atau 'admin'.");
  }
  return role;
}

const PUBLIC_FIELDS = {
  id: true,
  username: true,
  displayName: true,
  role: true,
  roleId: true,
  customRole: { select: { id: true, name: true } },
  isActive: true,
  createdAt: true,
  lastLoginAt: true,
} as const;

async function assertRoleIdExists(roleId: number): Promise<void> {
  const role = await prisma.customRole.findUnique({ where: { id: roleId }, select: { id: true } });
  if (!role) throw new UserError("Peran kustom tidak ditemukan.", 404);
}

export async function listUsers() {
  return prisma.user.findMany({
    select: PUBLIC_FIELDS,
    orderBy: [{ isActive: "desc" }, { username: "asc" }],
  });
}

async function countOtherActiveMasters(excludeUserId: number): Promise<number> {
  return prisma.user.count({
    where: { role: "master", isActive: true, id: { not: excludeUserId } },
  });
}

/** Guards the invariant that at least one usable master account always
 *  remains — otherwise the settings page becomes permanently unreachable. */
async function assertNotLastMaster(userId: number, action: string) {
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true },
  });
  if (!target) throw new UserError("Akun tidak ditemukan.", 404);
  if (target.role !== "master" || !target.isActive) return;

  const others = await countOtherActiveMasters(userId);
  if (others === 0) {
    throw new UserError(`Tidak bisa ${action} akun master terakhir yang masih aktif.`);
  }
}

export async function createUser(input: {
  username: unknown;
  password: unknown;
  role: unknown;
  displayName?: unknown;
  roleId?: unknown;
}) {
  const username = normalizeUsername(input.username);
  const password = assertPassword(input.password);
  const role = assertRole(input.role);
  const displayName = input.displayName ? String(input.displayName).trim().slice(0, 80) : null;

  let roleId: number | null = null;
  if (role === "admin" && input.roleId != null && input.roleId !== "") {
    roleId = Number(input.roleId);
    if (!Number.isInteger(roleId)) throw new UserError("Peran kustom tidak valid.");
    await assertRoleIdExists(roleId);
  }

  const existing = await prisma.user.findUnique({ where: { username }, select: { id: true } });
  if (existing) throw new UserError("Username sudah dipakai.", 409);

  return prisma.user.create({
    data: {
      username,
      displayName: displayName || null,
      passwordHash: await hashPassword(password),
      role,
      roleId,
      isActive: true,
    },
    select: PUBLIC_FIELDS,
  });
}

export async function updateUserRole(userId: number, role: unknown) {
  const nextRole = assertRole(role);
  if (nextRole !== "master") {
    await assertNotLastMaster(userId, "menurunkan role");
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    // A master account never carries a custom-role restriction, so promoting
    // to master always clears roleId.
    data: { role: nextRole, roleId: nextRole === "master" ? null : undefined },
    select: PUBLIC_FIELDS,
  });

  // Force a fresh login so the new privileges are the ones actually in effect.
  await revokeAllSessionsForUser(userId);
  return updated;
}

/** Assigns or clears the custom-role restriction on an admin-tier account.
 *  Passing null gives the account full (legacy) admin access. */
export async function updateUserCustomRole(userId: number, roleId: unknown) {
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!target) throw new UserError("Akun tidak ditemukan.", 404);
  if (target.role === "master") {
    throw new UserError("Akun master tidak bisa dibatasi dengan peran kustom.");
  }

  let nextRoleId: number | null = null;
  if (roleId != null && roleId !== "") {
    nextRoleId = Number(roleId);
    if (!Number.isInteger(nextRoleId)) throw new UserError("Peran kustom tidak valid.");
    await assertRoleIdExists(nextRoleId);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { roleId: nextRoleId },
    select: PUBLIC_FIELDS,
  });

  // The set of features just changed — force a fresh login/reload of nav.
  await revokeAllSessionsForUser(userId);
  return updated;
}

export async function updateUserActive(userId: number, isActive: unknown) {
  const next = isActive === true || isActive === "true";
  if (!next) {
    await assertNotLastMaster(userId, "menonaktifkan");
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isActive: next },
    select: PUBLIC_FIELDS,
  });

  if (!next) await revokeAllSessionsForUser(userId);
  return updated;
}

export async function resetUserPassword(userId: number, password: unknown) {
  const value = assertPassword(password);
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(value) },
    select: PUBLIC_FIELDS,
  });

  // A password change should invalidate anyone still holding an old session.
  await revokeAllSessionsForUser(userId);
  return updated;
}

/** Self-service password change. Keeps the caller's own session alive so they
 *  aren't logged out by their own action. */
export async function changeOwnPassword(
  userId: number,
  currentPassword: unknown,
  newPassword: unknown,
  keepSessionId: number,
) {
  const { verifyPasswordHash } = await import("../password");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user) throw new UserError("Akun tidak ditemukan.", 404);

  const ok = await verifyPasswordHash(String(currentPassword ?? ""), user.passwordHash);
  if (!ok) throw new UserError("Kata sandi saat ini salah.", 401);

  const value = assertPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(value) },
  });
  await revokeAllSessionsForUser(userId, keepSessionId);
}

export async function deleteUser(userId: number) {
  await assertNotLastMaster(userId, "menghapus");
  await prisma.user.delete({ where: { id: userId } });
}

export async function listActiveSessions() {
  return prisma.session.findMany({
    where: { revokedAt: null, expiresAt: { gt: new Date() } },
    select: {
      id: true,
      username: true,
      role: true,
      ip: true,
      userAgent: true,
      createdAt: true,
      lastSeenAt: true,
      userId: true,
    },
    orderBy: { lastSeenAt: "desc" },
  });
}

/** Creates the first master account from MASTER_PASSWORD so a fresh database
 *  is reachable without a manual seed step. Runs only when no account exists. */
export async function ensureAuthBootstrap(): Promise<void> {
  const count = await prisma.user.count();
  if (count > 0) return;

  const masterPw = process.env.MASTER_PASSWORD || process.env.APP_PASSWORD;
  if (!masterPw) {
    console.warn(
      "[auth] Belum ada akun dan MASTER_PASSWORD tidak diset — tidak bisa membuat akun master awal.",
    );
    return;
  }
  if (!checkPasswordPolicy(masterPw).ok) {
    console.warn(
      "[auth] MASTER_PASSWORD tidak memenuhi syarat (min 10 karakter, huruf + angka) — akun master awal tidak dibuat.",
    );
    return;
  }

  await prisma.user.create({
    data: {
      username: "master",
      displayName: "Master",
      passwordHash: await hashPassword(masterPw),
      role: "master",
      isActive: true,
    },
  });
  console.log("[auth] Akun master awal dibuat dari MASTER_PASSWORD (username: master).");
}
