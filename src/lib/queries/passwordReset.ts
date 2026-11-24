import { createHmac, randomBytes } from "node:crypto";
import { prisma } from "../prisma";
import { checkPasswordPolicy, fakeVerifyDelay, hashPassword, verifyPasswordHash } from "../password";

// 32 unambiguous uppercase alphanumeric characters (omits 0, O, 1, I) so byte & 31
// is uniform with zero modulo bias.
export const RESET_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const RESET_CODE_TTL_MS = 30 * 60 * 1000; // 30 menit
export const MAX_RESET_FAILED_ATTEMPTS = 5;
export const RECOVERY_CODE_COUNT = 8;

const UNIFORM_REDEEM_ERROR = "Username atau kode reset tidak valid atau sudah kedaluwarsa.";

export class PasswordResetError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function getHmacSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new PasswordResetError("SESSION_SECRET wajib diset minimal 32 karakter.", 500);
  }
  return secret;
}

/** Generates a hyphenated code (e.g. ABCD-EFGH-2345) from an unbiased 32-char alphabet. */
export function generateReadableCode(groupLength: number, groups: number): string {
  const totalChars = groupLength * groups;
  const bytes = randomBytes(totalChars);
  let raw = "";
  for (let i = 0; i < totalChars; i += 1) {
    raw += RESET_CODE_ALPHABET[bytes[i] & 31];
  }
  const parts: string[] = [];
  for (let i = 0; i < totalChars; i += groupLength) {
    parts.push(raw.slice(i, i + groupLength));
  }
  return parts.join("-");
}

/** Normalizes user-entered reset/recovery codes by trimming, uppercasing, and removing dashes/spaces. */
export function normalizeResetCode(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "");
}

/** Computes a domain-separated HMAC-SHA256 digest so raw reset/recovery codes are never stored. */
export function hashResetSecret(
  purpose: "reset-code" | "recovery-code",
  normalizedCode: string,
): string {
  return createHmac("sha256", getHmacSecret())
    .update(`${purpose}:${normalizedCode}`)
    .digest("hex");
}

export interface SubmitResetRequestResult {
  recorded: boolean;
  userId: number | null;
  username: string | null;
}

export async function submitPasswordResetRequest(input: {
  username: unknown;
  note?: unknown;
  ip?: string | null;
}): Promise<SubmitResetRequestResult> {
  const normalizedUsername = String(input.username ?? "").trim().toLowerCase();
  if (!normalizedUsername || normalizedUsername.length > 64) {
    return { recorded: false, userId: null, username: null };
  }

  const cleanNote =
    typeof input.note === "string" ? input.note.trim().slice(0, 200) || null : null;

  const user = await prisma.user.findUnique({
    where: { username: normalizedUsername },
    select: { id: true, username: true, isActive: true },
  });

  // Never disclose account existence or disabled state to callers.
  if (!user || !user.isActive) {
    return { recorded: false, userId: null, username: null };
  }

  await prisma.$transaction(async (tx) => {
    const existingPending = await tx.passwordResetRequest.findFirst({
      where: { userId: user.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (existingPending) {
      await tx.passwordResetRequest.update({
        where: { id: existingPending.id },
        data: {
          note: cleanNote,
          requestIp: input.ip ?? null,
          createdAt: new Date(),
        },
      });
    } else {
      await tx.passwordResetRequest.create({
        data: {
          userId: user.id,
          note: cleanNote,
          requestIp: input.ip ?? null,
          status: "PENDING",
        },
      });
    }
  });

  return { recorded: true, userId: user.id, username: user.username };
}

export interface PasswordResetRequestDTO {
  id: number;
  userId: number;
  note: string | null;
  requestIp: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "USED" | "EXPIRED";
  expiresAt: string | null;
  failedAttempts: number;
  approvedBy: string | null;
  approvedAt: string | null;
  usedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: number;
    username: string;
    displayName: string | null;
    role: string;
    isActive: boolean;
  };
}

function toResetRequestDTO(r: {
  id: number;
  userId: number;
  note: string | null;
  requestIp: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "USED" | "EXPIRED";
  expiresAt: Date | null;
  failedAttempts: number;
  approvedBy: string | null;
  approvedAt: Date | null;
  usedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: number;
    username: string;
    displayName: string | null;
    role: string;
    isActive: boolean;
  };
}): PasswordResetRequestDTO {
  return {
    id: r.id,
    userId: r.userId,
    note: r.note,
    requestIp: r.requestIp,
    status: r.status,
    expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
    failedAttempts: r.failedAttempts,
    approvedBy: r.approvedBy,
    approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null,
    usedAt: r.usedAt ? r.usedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    user: r.user,
  };
}

const REQUEST_SELECT = {
  id: true,
  userId: true,
  note: true,
  requestIp: true,
  status: true,
  expiresAt: true,
  failedAttempts: true,
  approvedBy: true,
  approvedAt: true,
  usedAt: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      isActive: true,
    },
  },
} as const;

export async function listPasswordResetRequests(): Promise<PasswordResetRequestDTO[]> {
  const now = new Date();
  await prisma.passwordResetRequest.updateMany({
    where: { status: "APPROVED", expiresAt: { lte: now } },
    data: { status: "EXPIRED", tokenHash: null },
  });

  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [active, recent] = await Promise.all([
    prisma.passwordResetRequest.findMany({
      where: { status: { in: ["PENDING", "APPROVED"] } },
      select: REQUEST_SELECT,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    prisma.passwordResetRequest.findMany({
      where: {
        status: { in: ["USED", "REJECTED", "EXPIRED"] },
        updatedAt: { gte: sevenDaysAgo },
      },
      select: REQUEST_SELECT,
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
  ]);

  return [...active, ...recent].map(toResetRequestDTO);
}

export interface IssuedResetCodeDTO {
  requestId: number;
  userId: number;
  username: string;
  code: string;
  expiresAt: string;
}

export async function approvePasswordResetRequest(
  requestId: number,
  approvedBy: string,
): Promise<IssuedResetCodeDTO> {
  const code = generateReadableCode(4, 3);
  const tokenHash = hashResetSecret("reset-code", normalizeResetCode(code));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + RESET_CODE_TTL_MS);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.passwordResetRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        userId: true,
        status: true,
        user: { select: { id: true, username: true, isActive: true } },
      },
    });
    if (!existing) throw new PasswordResetError("Permintaan reset tidak ditemukan.", 404);
    if (existing.status !== "PENDING") {
      throw new PasswordResetError("Permintaan reset sudah diproses sebelumnya.", 409);
    }
    if (!existing.user.isActive) {
      throw new PasswordResetError("Akun sedang dinonaktifkan.", 400);
    }

    await tx.passwordResetRequest.updateMany({
      where: { userId: existing.userId, status: "APPROVED", id: { not: existing.id } },
      data: { status: "EXPIRED", tokenHash: null },
    });

    const updated = await tx.passwordResetRequest.update({
      where: { id: existing.id },
      data: {
        status: "APPROVED",
        tokenHash,
        expiresAt,
        failedAttempts: 0,
        approvedBy,
        approvedAt: now,
      },
      select: { id: true, expiresAt: true },
    });

    return {
      requestId: updated.id,
      userId: existing.user.id,
      username: existing.user.username,
      code,
      expiresAt: (updated.expiresAt ?? expiresAt).toISOString(),
    };
  });
}

export async function issueDirectResetCodeForUser(
  userId: number,
  approvedBy: string,
): Promise<IssuedResetCodeDTO> {
  const code = generateReadableCode(4, 3);
  const tokenHash = hashResetSecret("reset-code", normalizeResetCode(code));
  const now = new Date();
  const expiresAt = new Date(now.getTime() + RESET_CODE_TTL_MS);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, isActive: true },
    });
    if (!user) throw new PasswordResetError("Akun tidak ditemukan.", 404);
    if (!user.isActive) {
      throw new PasswordResetError("Akun sedang dinonaktifkan. Aktifkan akun terlebih dahulu.", 400);
    }

    await tx.passwordResetRequest.updateMany({
      where: { userId: user.id, status: { in: ["PENDING", "APPROVED"] } },
      data: { status: "EXPIRED", tokenHash: null },
    });

    const created = await tx.passwordResetRequest.create({
      data: {
        userId: user.id,
        note: "Diterbitkan langsung oleh master",
        status: "APPROVED",
        tokenHash,
        expiresAt,
        failedAttempts: 0,
        approvedBy,
        approvedAt: now,
      },
      select: { id: true, expiresAt: true },
    });

    return {
      requestId: created.id,
      userId: user.id,
      username: user.username,
      code,
      expiresAt: (created.expiresAt ?? expiresAt).toISOString(),
    };
  });
}

export async function rejectPasswordResetRequest(
  requestId: number,
  rejectedBy: string,
): Promise<{ id: number; username: string }> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.passwordResetRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        status: true,
        user: { select: { username: true } },
      },
    });
    if (!existing) throw new PasswordResetError("Permintaan reset tidak ditemukan.", 404);
    if (existing.status !== "PENDING" && existing.status !== "APPROVED") {
      throw new PasswordResetError("Permintaan reset sudah selesai dan tidak dapat ditolak.", 409);
    }

    await tx.passwordResetRequest.update({
      where: { id: existing.id },
      data: {
        status: "REJECTED",
        tokenHash: null,
        approvedBy: rejectedBy,
        approvedAt: new Date(),
      },
    });

    return { id: existing.id, username: existing.user.username };
  });
}

export interface RedeemResetResult {
  userId: number;
  username: string;
  role: string;
  method: "reset_code" | "recovery_code";
}

export async function redeemPasswordReset(input: {
  username: unknown;
  code: unknown;
  newPassword: unknown;
}): Promise<RedeemResetResult> {
  const newPassword = String(input.newPassword ?? "");
  const policy = checkPasswordPolicy(newPassword);
  if (!policy.ok) {
    throw new PasswordResetError(policy.error ?? "Kata sandi tidak memenuhi syarat.", 400);
  }

  const normalizedUsername = String(input.username ?? "").trim().toLowerCase();
  const normalizedCode = normalizeResetCode(input.code);

  if (!normalizedUsername || (normalizedCode.length !== 12 && normalizedCode.length !== 16)) {
    await fakeVerifyDelay(normalizedCode || "invalid");
    throw new PasswordResetError(UNIFORM_REDEEM_ERROR, 400);
  }

  const user = await prisma.user.findUnique({
    where: { username: normalizedUsername },
    select: { id: true, username: true, role: true, isActive: true },
  });

  if (!user || !user.isActive) {
    await fakeVerifyDelay(normalizedCode);
    throw new PasswordResetError(UNIFORM_REDEEM_ERROR, 400);
  }

  const newPasswordHash = await hashPassword(newPassword);
  const now = new Date();

  const txOutcome = await prisma.$transaction(
    async (tx): Promise<{ ok: true; result: RedeemResetResult } | { ok: false }> => {
      if (user.role === "master" && normalizedCode.length === 16) {
        const codeHash = hashResetSecret("recovery-code", normalizedCode);
        const recUpdate = await tx.masterRecoveryCode.updateMany({
          where: { userId: user.id, codeHash, usedAt: null },
          data: { usedAt: now },
        });
        if (recUpdate.count === 1) {
          await tx.user.update({
            where: { id: user.id },
            data: { passwordHash: newPasswordHash },
          });
          await tx.session.updateMany({
            where: { userId: user.id, revokedAt: null },
            data: { revokedAt: now },
          });
          await tx.passwordResetRequest.updateMany({
            where: { userId: user.id, status: "APPROVED" },
            data: { status: "EXPIRED", tokenHash: null },
          });
          return {
            ok: true,
            result: {
              userId: user.id,
              username: user.username,
              role: user.role,
              method: "recovery_code",
            },
          };
        }
      }

      if (normalizedCode.length === 12) {
        const tokenHash = hashResetSecret("reset-code", normalizedCode);
        const resetUpdate = await tx.passwordResetRequest.updateMany({
          where: {
            userId: user.id,
            status: "APPROVED",
            tokenHash,
            expiresAt: { gt: now },
            failedAttempts: { lt: MAX_RESET_FAILED_ATTEMPTS },
          },
          data: {
            status: "USED",
            usedAt: now,
            tokenHash: null,
          },
        });
        if (resetUpdate.count === 1) {
          await tx.user.update({
            where: { id: user.id },
            data: { passwordHash: newPasswordHash },
          });
          await tx.session.updateMany({
            where: { userId: user.id, revokedAt: null },
            data: { revokedAt: now },
          });
          return {
            ok: true,
            result: {
              userId: user.id,
              username: user.username,
              role: user.role,
              method: "reset_code",
            },
          };
        }
      }

      // Persist failed attempts against any live APPROVED request outside rollback
      const activeApproved = await tx.passwordResetRequest.findFirst({
        where: { userId: user.id, status: "APPROVED", expiresAt: { gt: now } },
        orderBy: { approvedAt: "desc" },
        select: { id: true, failedAttempts: true },
      });
      if (activeApproved) {
        const nextAttempts = activeApproved.failedAttempts + 1;
        await tx.passwordResetRequest.update({
          where: { id: activeApproved.id },
          data:
            nextAttempts >= MAX_RESET_FAILED_ATTEMPTS
              ? { failedAttempts: nextAttempts, status: "EXPIRED", tokenHash: null }
              : { failedAttempts: nextAttempts },
        });
      }

      return { ok: false };
    },
  );

  if (!txOutcome.ok) {
    throw new PasswordResetError(UNIFORM_REDEEM_ERROR, 400);
  }

  return txOutcome.result;
}

export async function getMasterRecoveryCodeStatus(userId: number): Promise<{
  total: number;
  remaining: number;
  lastGeneratedAt: string | null;
}> {
  const [total, remaining, latest] = await Promise.all([
    prisma.masterRecoveryCode.count({ where: { userId } }),
    prisma.masterRecoveryCode.count({ where: { userId, usedAt: null } }),
    prisma.masterRecoveryCode.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  return {
    total,
    remaining,
    lastGeneratedAt: latest ? latest.createdAt.toISOString() : null,
  };
}

export async function regenerateMasterRecoveryCodes(
  userId: number,
  currentPassword: unknown,
): Promise<{ codes: string[]; generatedAt: string }> {
  const pw = String(currentPassword ?? "");
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, isActive: true, passwordHash: true },
  });

  if (!user || !user.isActive || user.role !== "master") {
    throw new PasswordResetError("Hanya akun master aktif yang dapat membuat kode pemulihan.", 403);
  }
  if (!pw || !(await verifyPasswordHash(pw, user.passwordHash))) {
    throw new PasswordResetError("Kata sandi saat ini salah.", 400);
  }

  const codes: string[] = [];
  const hashes = new Set<string>();
  while (codes.length < RECOVERY_CODE_COUNT) {
    const candidate = generateReadableCode(4, 4);
    const codeHash = hashResetSecret("recovery-code", normalizeResetCode(candidate));
    if (hashes.has(codeHash)) continue;
    hashes.add(codeHash);
    codes.push(candidate);
  }

  const now = new Date();
  const rows = [...hashes].map((codeHash) => ({
    userId: user.id,
    codeHash,
    createdAt: now,
  }));

  await prisma.$transaction(async (tx) => {
    await tx.masterRecoveryCode.deleteMany({ where: { userId: user.id } });
    await tx.masterRecoveryCode.createMany({ data: rows });
  });

  return { codes, generatedAt: now.toISOString() };
}

export async function purgeExpiredPasswordResetRequests(): Promise<void> {
  const now = new Date();
  await prisma.passwordResetRequest.updateMany({
    where: { status: "APPROVED", expiresAt: { lte: now } },
    data: { status: "EXPIRED", tokenHash: null },
  });
  const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  await prisma.passwordResetRequest.deleteMany({
    where: {
      status: { in: ["USED", "REJECTED", "EXPIRED"] },
      updatedAt: { lt: cutoff },
    },
  });
}
