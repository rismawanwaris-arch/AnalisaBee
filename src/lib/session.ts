import { SignJWT, jwtVerify } from "jose";
import { timingSafeEqual } from "crypto";

export const COOKIE_NAME = "analisabee_session";
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 hari

function getSecretKey() {
  const secret = process.env.SESSION_SECRET || "analisabee_fallback_super_secret_jwt_key_32bytes_long";
  return new TextEncoder().encode(secret);
}

/** Bandingkan password tanpa membocorkan panjang/waktu lewat timing attack. */
export function verifyPassword(input: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) {
    throw new Error("APP_PASSWORD belum diset di .env.");
  }
  const inputBuf = Buffer.from(input);
  const expectedBuf = Buffer.from(expected);
  if (inputBuf.length !== expectedBuf.length) {
    timingSafeEqual(inputBuf, inputBuf);
    return false;
  }
  return timingSafeEqual(inputBuf, expectedBuf);
}

export async function createSessionToken(): Promise<{ token: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const token = await new SignJWT({ auth: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(getSecretKey());
  return { token, expiresAt };
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: ["HS256"] });
    return payload.auth === true;
  } catch {
    return false;
  }
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
export const isAuthenticatedRequest = verifySessionToken;
