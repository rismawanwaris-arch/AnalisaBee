import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { timingSafeEqual } from "crypto";

const COOKIE_NAME = "analisabee_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 hari

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET belum diset. Generate dengan `openssl rand -base64 32` dan isi di .env."
    );
  }
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
    // Tetap jalankan compare dummy supaya waktu respons tidak membocorkan
    // informasi panjang password yang benar.
    timingSafeEqual(inputBuf, inputBuf);
    return false;
  }
  return timingSafeEqual(inputBuf, expectedBuf);
}

async function encryptSession(expiresAt: Date): Promise<string> {
  return new SignJWT({ auth: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(getSecretKey());
}

async function decryptSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: ["HS256"] });
    return payload.auth === true;
  } catch {
    return false;
  }
}

export async function createSession(): Promise<void> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const token = await encryptSession(expiresAt);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/** Untuk dipakai di Server Component/Route Handler — cek sesi dari cookie store Next.js. */
export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return decryptSession(cookieStore.get(COOKIE_NAME)?.value);
}

/** Untuk dipakai di proxy.ts — cek sesi langsung dari NextRequest (tidak lewat cookies()). */
export async function isAuthenticatedRequest(token: string | undefined): Promise<boolean> {
  return decryptSession(token);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
