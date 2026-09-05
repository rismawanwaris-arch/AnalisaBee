import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "./prisma";

export const COOKIE_NAME = "analisabee_session";
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 hari

export type UserRole = "admin" | "master";

export function isUserRole(value: unknown): value is UserRole {
  return value === "admin" || value === "master";
}

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET wajib diset di environment.");
  if (secret.length < 32) {
    throw new Error("SESSION_SECRET terlalu pendek — gunakan minimal 32 karakter acak.");
  }
  return new TextEncoder().encode(secret);
}

function safeCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    timingSafeEqual(aBuf, aBuf);
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

/** Break-glass check against the env-var passwords. Returns a role only when
 *  the input matches one of them. Database accounts are checked first by the
 *  login route; this is the fallback that keeps the app reachable if every
 *  account gets locked out. */
export function verifyEnvPassword(input: string): UserRole | null {
  const masterPw = process.env.MASTER_PASSWORD;
  const adminPw = process.env.ADMIN_PASSWORD;
  const legacyPw = process.env.APP_PASSWORD;

  if (masterPw && safeCompare(input, masterPw)) return "master";
  if (adminPw && safeCompare(input, adminPw)) return "admin";
  if (legacyPw && safeCompare(input, legacyPw)) return "master";
  return null;
}

/** The token the browser holds is a random id; only its digest is persisted,
 *  so read access to the sessions table can't be turned into a valid login. */
function hashSessionId(sessionId: string): string {
  return createHash("sha256").update(sessionId).digest("hex");
}

export interface SessionContext {
  sessionId: number;
  role: UserRole;
  username: string;
  userId: number | null;
}

export interface CreateSessionParams {
  role: UserRole;
  username: string;
  userId: number | null;
  ip: string | null;
  userAgent: string | null;
}

export async function createSession(
  params: CreateSessionParams,
): Promise<{ token: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const sessionId = randomBytes(32).toString("hex");

  await prisma.session.create({
    data: {
      tokenHash: hashSessionId(sessionId),
      userId: params.userId,
      username: params.username,
      role: params.role,
      ip: params.ip,
      userAgent: params.userAgent?.slice(0, 300) ?? null,
      expiresAt,
    },
  });

  const token = await new SignJWT({ auth: true, role: params.role, sid: sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(getSecretKey());

  return { token, expiresAt };
}

// Writing lastSeenAt on every request would turn each read into a write; a
// minute of staleness is plenty for an "active sessions" list.
const LAST_SEEN_REFRESH_MS = 60 * 1000;

/** Verifies the JWT signature *and* that the session is still live in the
 *  database. The database check is what makes a kick take effect immediately —
 *  a revoked session's token still has a valid signature. */
export async function verifySessionToken(
  token: string | undefined,
): Promise<SessionContext | null> {
  if (!token) return null;

  let sessionId: string;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: ["HS256"] });
    if (payload.auth !== true) return null;
    if (typeof payload.sid !== "string" || payload.sid.length === 0) return null;
    sessionId = payload.sid;
  } catch {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionId(sessionId) },
    select: {
      id: true,
      role: true,
      username: true,
      userId: true,
      revokedAt: true,
      expiresAt: true,
      lastSeenAt: true,
      user: { select: { isActive: true, role: true, username: true } },
    },
  });

  if (!session) return null;
  if (session.revokedAt !== null) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;

  // A deactivated account must stop working even if its session row is intact.
  if (session.user && !session.user.isActive) return null;

  // The account's current role wins over whatever was true at login time.
  const effectiveRole = session.user?.role ?? session.role;
  if (!isUserRole(effectiveRole)) return null;

  if (Date.now() - session.lastSeenAt.getTime() > LAST_SEEN_REFRESH_MS) {
    prisma.session
      .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
      .catch(() => {});
  }

  return {
    sessionId: session.id,
    role: effectiveRole,
    username: session.user?.username ?? session.username,
    userId: session.userId,
  };
}

export async function revokeSessionByToken(token: string | undefined): Promise<void> {
  if (!token) return;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: ["HS256"] });
    if (typeof payload.sid !== "string") return;
    await prisma.session.updateMany({
      where: { tokenHash: hashSessionId(payload.sid), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch {
    // an unparseable token has no session to revoke
  }
}

export async function revokeSessionById(sessionId: number): Promise<boolean> {
  const result = await prisma.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count > 0;
}

export async function revokeAllSessionsForUser(
  userId: number,
  exceptSessionId?: number,
): Promise<number> {
  const result = await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

/** Drops rows that can never authenticate again. Called on a timer so the
 *  table doesn't grow without bound. */
export async function purgeExpiredSessions(): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const result = await prisma.session.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lt: cutoff } }],
    },
  });
  return result.count;
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
