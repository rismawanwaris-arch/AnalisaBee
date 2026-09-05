import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

// scrypt is memory-hard, so a stolen hash resists GPU/ASIC cracking in a way
// plain SHA-family hashes do not. Node ships it, which keeps the Docker image
// free of a native build step (bcrypt/argon2 both need one).
const N = 32768;
const R = 8;
const P = 1;
const KEYLEN = 32;
const SALT_BYTES = 16;

function maxmemFor(n: number, r: number) {
  return 128 * n * r * 4;
}

/** Encodes params alongside the digest so the work factor can be raised later
 *  without invalidating hashes already in the database. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await scrypt(password.normalize("NFKC"), salt, KEYLEN, {
    N,
    r: R,
    p: P,
    maxmem: maxmemFor(N, R),
  });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPasswordHash(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  if (n < 1024 || n > 1048576 || r < 1 || r > 32 || p < 1 || p > 16) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4], "base64");
    expected = Buffer.from(parts[5], "base64");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  try {
    const key = await scrypt(password.normalize("NFKC"), salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: maxmemFor(n, r),
    });
    return key.length === expected.length && timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

// Burn roughly the same CPU as a real verify when the username doesn't exist,
// so response timing can't be used to enumerate valid usernames.
const DUMMY_HASH_PROMISE = hashPassword(randomBytes(32).toString("hex"));

export async function fakeVerifyDelay(password: string): Promise<void> {
  try {
    await verifyPasswordHash(password, await DUMMY_HASH_PROMISE);
  } catch {
    // never surfaces — this exists purely to consume time
  }
}

export interface PasswordPolicyResult {
  ok: boolean;
  error?: string;
}

export function checkPasswordPolicy(password: string): PasswordPolicyResult {
  if (password.length < 10) {
    return { ok: false, error: "Kata sandi minimal 10 karakter." };
  }
  if (password.length > 200) {
    return { ok: false, error: "Kata sandi maksimal 200 karakter." };
  }
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  if (!hasLetter || !hasDigit) {
    return { ok: false, error: "Kata sandi harus mengandung huruf dan angka." };
  }
  return { ok: true };
}
