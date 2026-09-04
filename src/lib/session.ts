import { SignJWT, jwtVerify } from "jose";
import { timingSafeEqual } from "crypto";

export const COOKIE_NAME = "analisabee_session";
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 hari

export type UserRole = "admin" | "master";

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET wajib diset di environment.");
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

/** Cek password dan kembalikan role, atau null jika tidak cocok. */
export function verifyPassword(input: string): UserRole | null {
  const masterPw = process.env.MASTER_PASSWORD;
  const adminPw = process.env.ADMIN_PASSWORD;
  // fallback: APP_PASSWORD lama dianggap master
  const legacyPw = process.env.APP_PASSWORD;

  if (masterPw && safeCompare(input, masterPw)) return "master";
  if (adminPw && safeCompare(input, adminPw)) return "admin";
  if (legacyPw && safeCompare(input, legacyPw)) return "master";
  return null;
}

export async function createSessionToken(role: UserRole): Promise<{ token: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const token = await new SignJWT({ auth: true, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(getSecretKey());
  return { token, expiresAt };
}

export async function verifySessionToken(token: string | undefined): Promise<UserRole | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: ["HS256"] });
    if (payload.auth !== true) return null;
    const role = payload.role as string;
    if (role === "master" || role === "admin") return role;
    // token lama tanpa role → anggap master
    return "master";
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
export const isAuthenticatedRequest = verifySessionToken;
