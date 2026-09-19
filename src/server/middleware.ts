// Shared request-handling building blocks used by every router in
// src/server/routes/*.ts — auth guards, activity logging, error formatting,
// caching and rate-limit primitives. Nothing here is route-specific; if a
// helper is only needed by one domain, it belongs in that route file instead.
import type express from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../lib/prisma";
import { verifySessionToken, COOKIE_NAME, type UserRole, type SessionContext } from "../lib/session";
import { resolveUserPermissions, hasFeature } from "../lib/permissions";
import { type FeatureKey } from "../lib/features";

// Extend Express's request type to carry the authenticated session — declared
// here (not per-router) since every router needs it and `declare global`
// only needs to be seen once by the TS compiler.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userRole?: UserRole;
      session?: SessionContext;
    }
  }
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.HTTPS === "true",
  sameSite: "lax" as const,
  path: "/",
};

// Centralized error response — never leak internal details to client in production
export function sendError(res: express.Response, status: number, err: unknown, fallback = "Terjadi kesalahan server.") {
  const isDev = process.env.NODE_ENV !== "production";
  const msg = isDev && err instanceof Error ? err.message : fallback;
  if (status >= 500) console.error(err);
  return res.status(status).json({ error: msg });
}

// Lets a browser reuse its own copy of slow-changing reference data (outlet
// list, employee list, period settings) for a few seconds instead of
// re-querying Postgres on every page navigation that needs a dropdown.
// `private` because it's tied to an authenticated session, not a shared/CDN
// cache — each user's browser only ever caches its own response.
export function cacheBriefly(seconds: number) {
  return (_req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.setHeader("Cache-Control", `private, max-age=${seconds}`);
    next();
  };
}

// Rate limiter for login — max 20 attempts per 15 minutes per IP
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Terlalu banyak percobaan login. Coba lagi dalam 15 menit." },
});

// Rate limiter for the public (no-login) points dashboard — generous enough
// for a tablet auto-refreshing every ~30-60s, tight enough to stop abuse.
export const publicPointsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Terlalu banyak permintaan, coba lagi sesaat lagi." },
});

// Auth middleware for API routes — any logged-in account (master or admin).
export async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const session = await verifySessionToken(req.cookies[COOKIE_NAME]);
  if (!session) {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    return res.status(401).json({ error: "Belum login." });
  }
  req.session = session;
  req.userRole = session.role;
  next();
}

export async function requireMaster(req: express.Request, res: express.Response, next: express.NextFunction) {
  const session = await verifySessionToken(req.cookies[COOKIE_NAME]);
  if (!session) {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    return res.status(401).json({ error: "Belum login." });
  }
  if (session.role !== "master") {
    return res.status(403).json({ error: "Akses ditolak. Hanya master yang bisa mengubah pengaturan." });
  }
  req.session = session;
  req.userRole = session.role;
  next();
}

// Gates a feature-area route for custom roles. `key` can be a fixed feature
// or a function of the request (e.g. reading `?branch=` to tell the Bandung
// and Cimahi target report apart, since both hit the same route).
export function requireFeature(key: FeatureKey | ((req: express.Request) => FeatureKey)) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const session = await verifySessionToken(req.cookies[COOKIE_NAME]);
    if (!session) {
      res.clearCookie(COOKIE_NAME, { path: "/" });
      return res.status(401).json({ error: "Belum login." });
    }
    req.session = session;
    req.userRole = session.role;

    const perms = await resolveUserPermissions(session);
    const featureKey = typeof key === "function" ? key(req) : key;
    if (!hasFeature(perms, featureKey)) {
      return res.status(403).json({ error: "Akun Anda tidak memiliki akses ke fitur ini." });
    }
    next();
  };
}

export function clientIp(req: express.Request): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress ?? null;
}

export async function logActivity(req: express.Request, action: string, detail?: string) {
  try {
    const actor = req.session?.username ? `${req.userRole}:${req.session.username}` : req.userRole ?? "unknown";
    await prisma.activityLog.create({
      data: {
        role: actor,
        action,
        detail: detail ?? null,
        ip: clientIp(req),
      },
    });
  } catch {
    // log failure must never break the main request
  }
}

export function parseDateParam(val: unknown): Date | undefined {
  if (typeof val !== "string" || !val) return undefined;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
