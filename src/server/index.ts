import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import multer from "multer";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { ensureDefaults } from "../lib/ensureDefaults";
import {
  verifyEnvPassword,
  createSession,
  verifySessionToken,
  revokeSessionByToken,
  revokeSessionById,
  purgeExpiredSessions,
  COOKIE_NAME,
  SESSION_DURATION_MS,
  type UserRole,
  type SessionContext,
} from "../lib/session";
import { verifyPasswordHash, fakeVerifyDelay } from "../lib/password";
import {
  listUsers,
  createUser,
  updateUserRole,
  updateUserActive,
  updateUserCustomRole,
  resetUserPassword,
  changeOwnPassword,
  deleteUser,
  listActiveSessions,
  ensureAuthBootstrap,
  UserError,
} from "../lib/queries/users";
import {
  listCustomRoles,
  createCustomRole,
  updateCustomRole,
  deleteCustomRole,
  RoleError,
} from "../lib/queries/roles";
import { resolveUserPermissions, hasFeature } from "../lib/permissions";
import { type FeatureKey } from "../lib/features";

// Extend Express request type to carry the authenticated session
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userRole?: UserRole;
      session?: SessionContext;
    }
  }
}

import { getSystemStatus } from "../lib/queries/systemStatus";
import { getDashboardSummary } from "../lib/queries/dashboard";
import { getOutletList, getOutletDetail, getOutletSummary } from "../lib/queries/outlets";
import { getEmployeeList, getEmployeeDetail } from "../lib/queries/employees";
import { searchItems, getItemDetail, getItemsByCategory } from "../lib/queries/items";
import { getSalesList, getSalesForExport, type SalesFilters } from "../lib/queries/sales";
import { parseSalesFilterParams } from "../lib/parseSalesFilterParams";
import {
  getDailyTargetReport,
  getTargetAmounts,
  setTargetAmount,
} from "../lib/queries/targetReport";
import { getHourlyAnalytics, type Granularity } from "../lib/queries/hourly";
import {
  getLeaderboard,
  getEmployeePointBreakdown,
  getPointPeriodSetting,
  setPointPeriodSetting,
  computeMonthPeriod,
  listItemPointRules,
  upsertItemPointRule,
  deleteItemPointRule,
  listGroupPointDefaults,
  upsertGroupPointDefault,
  deleteGroupPointDefault,
  listItemPointExclusions,
  addItemPointExclusion,
  removeItemPointExclusion,
  listExcludedEmployees,
  excludeEmployee,
  includeEmployee,
} from "../lib/queries/points";
import { previewSalesFile, importSalesFile } from "../lib/importSales";
import { invalidateDefaults } from "../lib/ensureDefaults";
import { parseTartunBuffer, parseServerBuffer, parseServerText } from "../lib/parseTartunServer";
import { importDailyMetric } from "../lib/importTartunServer";
import type { BusinessLine, ReportCategory } from "@/generated/prisma/client";

const app = express();

// Multer: validate file type server-side, consistent 25MB limit with frontend
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === ".xls" || ext === ".xlsx") return cb(null, true);
    cb(new Error("Format file tidak didukung. Gunakan .xls atau .xlsx."));
  },
});

// Security headers
app.use(helmet({ contentSecurityPolicy: false }));

// CORS: only needed in development (Vite :5173 → Express :3001).
// In production the SPA is served by Express itself — same origin, no CORS required.
if (process.env.NODE_ENV !== "production") {
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : null; // null = allow all localhost
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (!allowedOrigins) {
        // dev default: allow any localhost regardless of port
        if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);
      } else if (allowedOrigins.includes(origin)) {
        return cb(null, true);
      }
      cb(new Error("CORS: origin tidak diizinkan"));
    },
    credentials: true,
  }));
}

app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Centralized error response — never leak internal details to client in production
function sendError(res: express.Response, status: number, err: unknown, fallback = "Terjadi kesalahan server.") {
  const isDev = process.env.NODE_ENV !== "production";
  const msg = isDev && err instanceof Error ? err.message : fallback;
  if (status >= 500) console.error(err);
  return res.status(status).json({ error: msg });
}

// Rate limiter for login — max 20 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Terlalu banyak percobaan login. Coba lagi dalam 15 menit." },
});

// Initialize defaults on server startup
ensureDefaults().catch((err) => console.error("ensureDefaults error:", err));
ensureAuthBootstrap().catch((err) => console.error("ensureAuthBootstrap error:", err));

// Keep the sessions table from growing without bound.
purgeExpiredSessions().catch(() => {});
setInterval(() => {
  purgeExpiredSessions().catch(() => {});
}, 6 * 60 * 60 * 1000).unref();

// Auth Middleware for API
async function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const session = await verifySessionToken(req.cookies[COOKIE_NAME]);
  if (!session) {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    return res.status(401).json({ error: "Belum login." });
  }
  req.session = session;
  req.userRole = session.role;
  next();
}

async function requireMaster(req: express.Request, res: express.Response, next: express.NextFunction) {
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
function requireFeature(key: FeatureKey | ((req: express.Request) => FeatureKey)) {
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

function clientIp(req: express.Request): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress ?? null;
}

async function logActivity(req: express.Request, action: string, detail?: string) {
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

function parseDateParam(val: unknown): Date | undefined {
  if (typeof val !== "string" || !val) return undefined;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

// ==========================================
// 1. AUTHENTICATION
// ==========================================

const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.HTTPS === "true",
  sameSite: "lax" as const,
  path: "/",
};

app.post("/api/auth/login", loginLimiter, async (req, res) => {
  const rawUsername = String(req.body?.username ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  const ip = clientIp(req);
  const userAgent = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null;

  // One message for every failure mode — never reveal whether a username exists.
  const reject = () => res.status(401).json({ error: "Username atau kata sandi salah." });

  if (!password) {
    await fakeVerifyDelay(password);
    return reject();
  }

  try {
    const account = rawUsername
      ? await prisma.user.findUnique({
          where: { username: rawUsername },
          select: { id: true, username: true, passwordHash: true, role: true, isActive: true },
        })
      : null;

    let resolved: { role: UserRole; username: string; userId: number | null };

    if (account) {
      const ok = await verifyPasswordHash(password, account.passwordHash);
      if (!ok) {
        prisma.activityLog
          .create({ data: { role: rawUsername, action: "LOGIN_GAGAL", ip } })
          .catch(() => {});
        return reject();
      }
      if (!account.isActive) {
        return res.status(403).json({ error: "Akun dinonaktifkan. Hubungi pemilik akun master." });
      }
      if (account.role !== "master" && account.role !== "admin") return reject();
      resolved = { role: account.role, username: account.username, userId: account.id };
    } else {
      // Break-glass: the env-var passwords, addressed as username master/admin.
      const envRole = verifyEnvPassword(password);
      if (!envRole || (rawUsername !== "" && rawUsername !== envRole)) {
        await fakeVerifyDelay(password);
        prisma.activityLog
          .create({ data: { role: rawUsername || "unknown", action: "LOGIN_GAGAL", ip } })
          .catch(() => {});
        return reject();
      }
      resolved = { role: envRole, username: `${envRole} (env)`, userId: null };
    }

    const { role, username, userId } = resolved;
    const { token } = await createSession({ role, username, userId, ip, userAgent });
    res.cookie(COOKIE_NAME, token, { ...SESSION_COOKIE_OPTIONS, maxAge: SESSION_DURATION_MS });

    if (userId !== null) {
      prisma.user
        .update({ where: { id: userId }, data: { lastLoginAt: new Date() } })
        .catch(() => {});
    }
    prisma.activityLog
      .create({
        data: {
          role: `${role}:${username}`,
          action: userId === null ? "LOGIN_ENV" : "LOGIN",
          ip,
        },
      })
      .catch(() => {});

    return res.json({ ok: true, role, username });
  } catch (err) {
    return sendError(res, 500, err, "Gagal memproses login.");
  }
});

app.post("/api/auth/logout", async (req, res) => {
  await revokeSessionByToken(req.cookies[COOKIE_NAME]).catch(() => {});
  res.clearCookie(COOKIE_NAME, { path: "/" });
  return res.json({ ok: true });
});

app.get("/api/auth/me", async (req, res) => {
  const session = await verifySessionToken(req.cookies[COOKIE_NAME]);
  if (!session) {
    return res.json({ authenticated: false, role: null, username: null });
  }
  const perms = await resolveUserPermissions(session);
  return res.json({
    authenticated: true,
    role: session.role,
    username: session.username,
    userId: session.userId,
    permissions: perms === "all" ? "all" : [...perms],
  });
});

app.post("/api/auth/change-password", requireAuth, async (req, res) => {
  if (req.session!.userId === null) {
    return res.status(400).json({
      error: "Sesi ini memakai kata sandi environment, bukan akun. Ganti lewat file .env.",
    });
  }
  try {
    await changeOwnPassword(
      req.session!.userId,
      req.body?.currentPassword,
      req.body?.newPassword,
      req.session!.sessionId,
    );
    await logActivity(req, "UBAH_PASSWORD_SENDIRI");
    return res.json({ ok: true });
  } catch (err) {
    if (err instanceof UserError) return res.status(err.status).json({ error: err.message });
    return sendError(res, 500, err, "Gagal mengganti kata sandi.");
  }
});

// ==========================================
// 1b. ACCOUNT & SESSION MANAGEMENT (master only)
// ==========================================

app.get("/api/users", requireMaster, async (_req, res) => {
  try {
    return res.json(await listUsers());
  } catch (err) {
    return sendError(res, 500, err, "Gagal memuat daftar akun.");
  }
});

app.post("/api/users", requireMaster, async (req, res) => {
  try {
    const user = await createUser({
      username: req.body?.username,
      password: req.body?.password,
      role: req.body?.role,
      displayName: req.body?.displayName,
      roleId: req.body?.roleId,
    });
    await logActivity(req, "BUAT_AKUN", `${user.username} (${user.role})`);
    return res.status(201).json(user);
  } catch (err) {
    if (err instanceof UserError) return res.status(err.status).json({ error: err.message });
    return sendError(res, 500, err, "Gagal membuat akun.");
  }
});

app.put("/api/users/:id/custom-role", requireMaster, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "ID tidak valid." });
  try {
    const user = await updateUserCustomRole(id, req.body?.roleId);
    await logActivity(req, "UBAH_PERAN_KUSTOM_AKUN", `${user.username} → ${user.customRole?.name ?? "akses penuh"}`);
    return res.json(user);
  } catch (err) {
    if (err instanceof UserError) return res.status(err.status).json({ error: err.message });
    return sendError(res, 500, err, "Gagal mengubah peran akun.");
  }
});

app.put("/api/users/:id/role", requireMaster, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "ID tidak valid." });
  try {
    const user = await updateUserRole(id, req.body?.role);
    await logActivity(req, "UBAH_ROLE_AKUN", `${user.username} → ${user.role}`);
    return res.json(user);
  } catch (err) {
    if (err instanceof UserError) return res.status(err.status).json({ error: err.message });
    return sendError(res, 500, err, "Gagal mengubah role.");
  }
});

app.put("/api/users/:id/active", requireMaster, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "ID tidak valid." });
  try {
    const user = await updateUserActive(id, req.body?.isActive);
    await logActivity(req, user.isActive ? "AKTIFKAN_AKUN" : "NONAKTIFKAN_AKUN", user.username);
    return res.json(user);
  } catch (err) {
    if (err instanceof UserError) return res.status(err.status).json({ error: err.message });
    return sendError(res, 500, err, "Gagal mengubah status akun.");
  }
});

app.put("/api/users/:id/password", requireMaster, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "ID tidak valid." });
  try {
    const user = await resetUserPassword(id, req.body?.password);
    await logActivity(req, "RESET_PASSWORD_AKUN", user.username);
    return res.json({ ok: true });
  } catch (err) {
    if (err instanceof UserError) return res.status(err.status).json({ error: err.message });
    return sendError(res, 500, err, "Gagal mereset kata sandi.");
  }
});

app.delete("/api/users/:id", requireMaster, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "ID tidak valid." });
  if (req.session!.userId === id) {
    return res.status(400).json({ error: "Tidak bisa menghapus akun Anda sendiri." });
  }
  try {
    await deleteUser(id);
    await logActivity(req, "HAPUS_AKUN", String(id));
    return res.json({ ok: true });
  } catch (err) {
    if (err instanceof UserError) return res.status(err.status).json({ error: err.message });
    return sendError(res, 500, err, "Gagal menghapus akun.");
  }
});

app.get("/api/sessions", requireMaster, async (req, res) => {
  try {
    const sessions = await listActiveSessions();
    return res.json(
      sessions.map((s) => ({ ...s, isCurrent: s.id === req.session!.sessionId })),
    );
  } catch (err) {
    return sendError(res, 500, err, "Gagal memuat sesi aktif.");
  }
});

app.delete("/api/sessions/:id", requireMaster, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "ID tidak valid." });
  if (id === req.session!.sessionId) {
    return res.status(400).json({ error: "Gunakan tombol keluar untuk mengakhiri sesi Anda sendiri." });
  }
  try {
    const revoked = await revokeSessionById(id);
    if (!revoked) return res.status(404).json({ error: "Sesi tidak ditemukan atau sudah berakhir." });
    await logActivity(req, "KICK_SESI", String(id));
    return res.json({ ok: true });
  } catch (err) {
    return sendError(res, 500, err, "Gagal mengakhiri sesi.");
  }
});

// ==========================================
// 1c. CUSTOM ROLES (master only)
// ==========================================

app.get("/api/roles", requireMaster, async (_req, res) => {
  try {
    return res.json(await listCustomRoles());
  } catch (err) {
    return sendError(res, 500, err, "Gagal memuat daftar peran.");
  }
});

app.post("/api/roles", requireMaster, async (req, res) => {
  try {
    const role = await createCustomRole({
      name: req.body?.name,
      permissions: req.body?.permissions,
    });
    await logActivity(req, "BUAT_PERAN", role.name);
    return res.status(201).json(role);
  } catch (err) {
    if (err instanceof RoleError) return res.status(err.status).json({ error: err.message });
    return sendError(res, 500, err, "Gagal membuat peran.");
  }
});

app.put("/api/roles/:id", requireMaster, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "ID tidak valid." });
  try {
    const role = await updateCustomRole(id, {
      name: req.body?.name,
      permissions: req.body?.permissions,
    });
    await logActivity(req, "UBAH_PERAN", role.name);
    return res.json(role);
  } catch (err) {
    if (err instanceof RoleError) return res.status(err.status).json({ error: err.message });
    return sendError(res, 500, err, "Gagal mengubah peran.");
  }
});

app.delete("/api/roles/:id", requireMaster, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "ID tidak valid." });
  try {
    await deleteCustomRole(id);
    await logActivity(req, "HAPUS_PERAN", String(id));
    return res.json({ ok: true });
  } catch (err) {
    if (err instanceof RoleError) return res.status(err.status).json({ error: err.message });
    return sendError(res, 500, err, "Gagal menghapus peran.");
  }
});

// ==========================================
// 2. SYSTEM STATUS & DASHBOARD
// ==========================================

// Not feature-gated: AppLayout fetches this for the sidebar widget on every
// page, not just the Dashboard, so any authenticated account needs it.
app.get("/api/status", requireAuth, async (req, res) => {
  try {
    const status = await getSystemStatus();
    return res.json(status);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/dashboard", requireFeature("dashboard"), async (req, res) => {
  try {
    const from = parseDateParam(req.query.from);
    const to = parseDateParam(req.query.to);
    const summary = await getDashboardSummary({ from, to });
    return res.json(summary);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. OUTLETS & EMPLOYEES
// ==========================================

// Not feature-gated: this is a shared outlet-name reference used as a filter
// dropdown by several pages (Dashboard, Transactions, Jam Operasional,
// Settings), not exclusive to the Performa Outlet page.
app.get("/api/outlets", requireAuth, async (req, res) => {
  try {
    const includeHidden = req.query.includeHidden === "true" || req.query.includeHidden === "1";
    const list = await getOutletList(includeHidden);
    return res.json(list);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/outlets/summary", requireFeature("outlets"), async (req, res) => {
  try {
    const from = parseDateParam(req.query.from);
    const to = parseDateParam(req.query.to);
    const itemId = req.query.itemId ? Number(req.query.itemId) : undefined;
    const employeeId = req.query.employeeId ? Number(req.query.employeeId) : undefined;
    const subtotalMin = req.query.subtotalMin ? Number(req.query.subtotalMin) : undefined;
    const subtotalMax = req.query.subtotalMax ? Number(req.query.subtotalMax) : undefined;
    const rows = await getOutletSummary({ from, to, itemId, employeeId, subtotalMin, subtotalMax });
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put("/api/outlets/:id/branch", requireMaster, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "ID tidak valid" });
    const { branch } = req.body;
    if (branch !== "BANDUNG" && branch !== "CIMAHI") {
      return res.status(400).json({ error: "branch harus BANDUNG atau CIMAHI" });
    }
    const updated = await prisma.outlet.update({
      where: { id },
      data: { branch },
      select: { id: true, name: true, branch: true },
    });
    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put("/api/outlets/:id/visibility", requireMaster, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "ID tidak valid" });
    const { isHidden } = req.body;
    const updated = await prisma.outlet.update({
      where: { id },
      data: { isHidden: Boolean(isHidden) },
      select: { id: true, name: true, isHidden: true },
    });
    await logActivity(req, "OUTLET_VISIBILITY", `${updated.name} → ${isHidden ? "disembunyikan" : "ditampilkan"}`);
    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/outlets/:id", requireFeature("outlets"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "ID tidak valid" });
    const detail = await getOutletDetail(id);
    if (!detail) return res.status(404).json({ error: "Outlet tidak ditemukan" });
    return res.json(detail);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/employees", requireAuth, async (req, res) => {
  try {
    const includeHidden = req.query.includeHidden === "true" || req.query.includeHidden === "1";
    const list = await getEmployeeList(includeHidden);
    return res.json(list);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put("/api/employees/:id/visibility", requireMaster, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "ID tidak valid" });
    const { isHidden } = req.body;
    const updated = await prisma.employee.update({
      where: { id },
      data: { isHidden: Boolean(isHidden) },
      select: { id: true, name: true, isHidden: true },
    });
    await logActivity(req, "EMPLOYEE_VISIBILITY", `${updated.name} → ${isHidden ? "disembunyikan" : "ditampilkan"}`);
    return res.json(updated);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/employees/:id", requireFeature("employees"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "ID tidak valid" });
    const detail = await getEmployeeDetail(id);
    if (!detail) return res.status(404).json({ error: "Pegawai tidak ditemukan" });
    return res.json(detail);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. ITEMS & SALES EXPLORER
// ==========================================

app.get("/api/items", requireFeature("items"), async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : "";
    const limit = Number(req.query.limit) || 20;
    const items = await searchItems(q, limit);
    return res.json(items);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/items/by-category", requireFeature("item_categories"), async (req, res) => {
  try {
    const from = parseDateParam(req.query.from);
    const to = parseDateParam(req.query.to);
    const rows = await getItemsByCategory({ from, to });
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/items/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "ID tidak valid" });
    const from = parseDateParam(req.query.from);
    const to = parseDateParam(req.query.to);
    const detail = await getItemDetail(id, { from, to });
    if (!detail) return res.status(404).json({ error: "Item tidak ditemukan" });
    return res.json(detail);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/sales", requireFeature("transactions"), async (req, res) => {
  try {
    const params = new URLSearchParams(req.query as any);
    const filter = parseSalesFilterParams(params);
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(Math.max(1, Number(req.query.pageSize) || 50), 200);
    const result = await getSalesList(filter, page, pageSize);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/sales/export", requireFeature("transactions"), async (req, res) => {
  try {
    const params = new URLSearchParams(req.query as any);
    const filter = parseSalesFilterParams(params);
    const rows = await getSalesForExport(filter);

    const headers = [
      "No Transaksi",
      "Tanggal",
      "Jam",
      "Outlet",
      "Kode Item",
      "Nama Item",
      "Qty",
      "Satuan",
      "Harga Jual",
      "Subtotal",
      "Laba/Rugi",
      "Pegawai",
    ];

    const csvRows = [
      headers.join(","),
      ...rows.map((r) =>
        [
          `"${r.noTransaksi}"`,
          `"${r.tanggal.slice(0, 10)}"`,
          `"${r.jamBuat}"`,
          `"${r.outletName.replace(/"/g, '""')}"`,
          `"${r.itemCode.replace(/"/g, '""')}"`,
          `"${r.itemName.replace(/"/g, '""')}"`,
          r.qty,
          `"${r.unit}"`,
          r.hargaJual,
          r.subtotal,
          r.labaRugi,
          `"${r.employeeName.replace(/"/g, '""')}"`,
        ].join(",")
      ),
    ];

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="penjualan-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    return res.send(csvRows.join("\n"));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. TARGET & HOURLY REPORTS
// ==========================================

const targetReportFeature = (req: express.Request): FeatureKey =>
  req.query.branch === "CIMAHI" ? "target_cimahi" : "target_bandung";

app.get("/api/target/report", requireFeature(targetReportFeature), async (req, res) => {
  try {
    const dateParam = req.query.date as string;
    const date = dateParam ? new Date(dateParam) : null;
    if (!date || Number.isNaN(date.getTime())) {
      return res.status(400).json({ error: "Parameter date wajib diisi (YYYY-MM-DD)." });
    }
    const branch = (req.query.branch === "CIMAHI" ? "CIMAHI" : "BANDUNG") as "BANDUNG" | "CIMAHI";
    const [report, targets] = await Promise.all([getDailyTargetReport(date, branch), getTargetAmounts(branch)]);
    return res.json({
      date: dateParam,
      branch,
      rows: report.rows,
      unmappedItemGroups: report.unmappedItemGroups,
      targets,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Master-only: this returns editable amounts and is consumed only by the
// Settings page's target-editing forms, not the (feature-gated) report pages.
app.get("/api/target", requireMaster, async (req, res) => {
  try {
    const branch = (req.query.branch === "CIMAHI" ? "CIMAHI" : "BANDUNG") as "BANDUNG" | "CIMAHI";
    const targets = await getTargetAmounts(branch);
    return res.json(targets);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put("/api/target", requireMaster, async (req, res) => {
  try {
    const branch = (req.query.branch === "CIMAHI" ? "CIMAHI" : "BANDUNG") as "BANDUNG" | "CIMAHI";
    const body = req.body;
    if (Array.isArray(body)) {
      await Promise.all(
        body.map((e: any) => setTargetAmount(e.scope, e.category, Number(e.amount) || 0, branch))
      );
    }
    const targets = await getTargetAmounts(branch);
    await logActivity(req, "TARGET_UPDATE", `[${branch}] ${Array.isArray(body) ? body.length : 1} entri diperbarui`);
    return res.json(targets);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/target", requireMaster, async (req, res) => {
  try {
    const { scope, category, amount } = req.body;
    if (scope !== "PERKONTER" && scope !== "ALL") {
      return res.status(400).json({ error: "scope harus PERKONTER atau ALL" });
    }
    const validCategories: BusinessLine[] = [
      "SERVER",
      "TARTUN",
      "PETSHOP",
      "AKSESORIS",
      "SP_VOUCHER",
    ];
    if (!validCategories.includes(category)) {
      return res.status(400).json({ error: "category tidak valid" });
    }
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount < 0) {
      return res.status(400).json({ error: "amount harus angka positif" });
    }
    await setTargetAmount(scope, category, numAmount);
    await logActivity(req, "TARGET_UPDATE", `${scope} ${category} = ${numAmount}`);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/hourly", requireFeature("target_bandung"), async (req, res) => {
  try {
    const dateStr = req.query.date as string;
    if (!dateStr) return res.status(400).json({ error: "Parameter date wajib diisi." });
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
      return res.status(400).json({ error: "Tanggal tidak valid." });
    }

    const VALID_GRANULARITIES: Granularity[] = ["EXACT", "15MIN", "30MIN", "1HOUR"];
    const granularity: Granularity = VALID_GRANULARITIES.includes(req.query.granularity as Granularity)
      ? (req.query.granularity as Granularity)
      : "EXACT";
    const outletId = req.query.outletId ? Number(req.query.outletId) : undefined;
    const report = await getHourlyAnalytics(date, outletId, granularity);
    return res.json(report);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6. POINTS & INCENTIVES
// ==========================================

app.get("/api/points/leaderboard", requireFeature("points"), async (req, res) => {
  try {
    let from: Date;
    let to: Date;

    const fromParam = parseDateParam(req.query.from);
    const toParam = parseDateParam(req.query.to);

    if (fromParam && toParam) {
      from = fromParam;
      to = toParam;
    } else {
      const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
      const month = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1;
      const { periodStartDay } = await getPointPeriodSetting();
      const p = computeMonthPeriod(year, month, periodStartDay);
      from = p.from;
      to = p.to;
    }

    const data = await getLeaderboard(from, to);
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Master-only: consumed only by the Settings page's cut-off day form.
app.get("/api/points/settings", requireMaster, async (req, res) => {
  try {
    const data = await getPointPeriodSetting();
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.put("/api/points/settings", requireMaster, async (req, res) => {
  try {
    const { periodStartDay } = req.body;
    const day = Number(periodStartDay);
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      return res.status(400).json({ error: "Tanggal harus 1-31." });
    }
    await setPointPeriodSetting(day);
    await logActivity(req, "PERIOD_UPDATE", `Tanggal mulai siklus → ${day}`);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/points/settings", requireMaster, async (req, res) => {
  try {
    const { periodStartDay } = req.body;
    const day = Number(periodStartDay);
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      return res.status(400).json({ error: "Tanggal harus 1-31." });
    }
    await setPointPeriodSetting(day);
    await logActivity(req, "PERIOD_UPDATE", `Tanggal mulai siklus → ${day}`);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/points/employee/:id", requireFeature("points"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ error: "ID tidak valid" });

    let from: Date;
    let to: Date;
    const fromParam = parseDateParam(req.query.from);
    const toParam = parseDateParam(req.query.to);

    if (fromParam && toParam) {
      from = fromParam;
      to = toParam;
    } else {
      const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();
      const month = req.query.month ? Number(req.query.month) : new Date().getMonth() + 1;
      const { periodStartDay } = await getPointPeriodSetting();
      const p = computeMonthPeriod(year, month, periodStartDay);
      from = p.from;
      to = p.to;
    }

    const breakdown = await getEmployeePointBreakdown(id, from, to);
    return res.json(breakdown);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Master-only: the following point-rule/mapping GETs are consumed only by
// the Settings page's management sections, not by the public leaderboard.
app.get("/api/points/items", requireMaster, async (req, res) => {
  try {
    const rules = await listItemPointRules();
    return res.json(rules);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/points/items", requireMaster, async (req, res) => {
  try {
    const { pattern, points } = req.body;
    const p = String(pattern || "").trim();
    const pts = Number(points);
    if (!p) return res.status(400).json({ error: "Pola item wajib diisi." });
    if (!Number.isInteger(pts) || pts < 0) {
      return res.status(400).json({ error: "Poin harus integer >= 0." });
    }
    const rule = await upsertItemPointRule(p, pts);
    await logActivity(req, "ITEM_RULE_ADD", `"${p}" = ${pts} poin`);
    return res.json(rule);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete("/api/points/items/:id", requireMaster, async (req, res) => {
  try {
    await deleteItemPointRule(Number(req.params.id));
    await logActivity(req, "ITEM_RULE_DELETE", `id=${req.params.id}`);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/points/item-exclusions", requireMaster, async (req, res) => {
  try {
    const list = await listItemPointExclusions();
    return res.json(list);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/points/item-exclusions", requireMaster, async (req, res) => {
  try {
    const { pattern } = req.body;
    const p = String(pattern || "").trim();
    if (!p) return res.status(400).json({ error: "Pola item wajib diisi." });
    const excl = await addItemPointExclusion(p);
    await logActivity(req, "ITEM_EXCLUSION_ADD", `"${p}"`);
    return res.json(excl);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete("/api/points/item-exclusions/:id", requireMaster, async (req, res) => {
  try {
    await removeItemPointExclusion(Number(req.params.id));
    await logActivity(req, "ITEM_EXCLUSION_DELETE", `id=${req.params.id}`);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/points/group-defaults", requireMaster, async (req, res) => {
  try {
    const list = await listGroupPointDefaults();
    return res.json(list);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/points/group-defaults", requireMaster, async (req, res) => {
  try {
    const { itemGroup, points } = req.body;
    const g = String(itemGroup || "").trim();
    const pts = Number(points);
    if (!g) return res.status(400).json({ error: "Item Group wajib diisi." });
    if (!Number.isInteger(pts) || pts < 0) {
      return res.status(400).json({ error: "Poin harus integer >= 0." });
    }
    const row = await upsertGroupPointDefault(g, pts);
    await logActivity(req, "GROUP_DEFAULT_ADD", `"${g}" = ${pts} poin`);
    return res.json(row);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete("/api/points/group-defaults/:id", requireMaster, async (req, res) => {
  try {
    await deleteGroupPointDefault(Number(req.params.id));
    await logActivity(req, "GROUP_DEFAULT_DELETE", `id=${req.params.id}`);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/points/excluded-employees", requireMaster, async (req, res) => {
  try {
    const list = await listExcludedEmployees();
    return res.json(
      list.map((x) => ({
        id: x.id,
        employeeId: x.employeeId,
        employeeName: x.employee.name,
        reason: x.reason,
      }))
    );
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/points/excluded-employees", requireMaster, async (req, res) => {
  try {
    const { employeeId, reason } = req.body;
    const empId = Number(employeeId);
    if (Number.isNaN(empId)) return res.status(400).json({ error: "Pilih pegawai." });
    const row = await excludeEmployee(empId, reason ? String(reason).trim() : undefined);
    const emp = await prisma.employee.findUnique({ where: { id: empId }, select: { name: true } });
    await logActivity(req, "EMPLOYEE_EXCLUSION_ADD", `${emp?.name ?? empId}${reason ? ` (${reason})` : ""}`);
    return res.json(row);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete("/api/points/excluded-employees/:id", requireMaster, async (req, res) => {
  try {
    await includeEmployee(Number(req.params.id));
    await logActivity(req, "EMPLOYEE_EXCLUSION_DELETE", `id=${req.params.id}`);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 7. MAPPINGS
// ==========================================

app.get("/api/mappings/item-group", requireMaster, async (req, res) => {
  try {
    const list = await prisma.itemGroupMapping.findMany({
      orderBy: [{ isDefault: "asc" }, { itemGroup: "asc" }],
    });
    return res.json(list);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/mappings/item-group", requireMaster, async (req, res) => {
  try {
    const { itemGroup, category } = req.body;
    const group = String(itemGroup || "").trim();
    if (!group) return res.status(400).json({ error: "Item Group wajib diisi." });
    const validCats: ReportCategory[] = ["PETSHOP", "AKSESORIS", "SP_VOUCHER"];
    if (!validCats.includes(category)) {
      return res.status(400).json({ error: "Kategori tidak valid." });
    }

    const mapping = await prisma.itemGroupMapping.upsert({
      where: { itemGroup: group },
      update: { category, isDefault: false },
      create: { itemGroup: group, category, isDefault: false },
    });
    await logActivity(req, "GROUP_MAPPING_ADD", `"${group}" → ${category}`);
    return res.json(mapping);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete("/api/mappings/item-group/:id", requireMaster, async (req, res) => {
  try {
    await prisma.itemGroupMapping.delete({ where: { id: Number(req.params.id) } });
    await logActivity(req, "GROUP_MAPPING_DELETE", `id=${req.params.id}`);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/mappings/outlet-alias", requireMaster, async (req, res) => {
  try {
    const list = await prisma.outletAlias.findMany({
      include: { outlet: { select: { name: true } } },
      orderBy: { alias: "asc" },
    });
    return res.json(
      list.map((a) => ({
        id: a.id,
        alias: a.alias,
        outletId: a.outletId,
        outletName: a.outlet.name,
        isDefault: a.isDefault,
      }))
    );
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/mappings/outlet-alias", requireMaster, async (req, res) => {
  try {
    const { alias, outletId } = req.body;
    const al = String(alias || "").trim();
    const oid = Number(outletId);
    if (!al) return res.status(400).json({ error: "Alias wajib diisi." });
    if (Number.isNaN(oid)) return res.status(400).json({ error: "Pilih outlet." });

    const mapping = await prisma.outletAlias.upsert({
      where: { alias: al },
      update: { outletId: oid, isDefault: false },
      create: { alias: al, outletId: oid, isDefault: false },
    });
    const outlet = await prisma.outlet.findUnique({ where: { id: oid }, select: { name: true } });
    await logActivity(req, "ALIAS_ADD", `"${al}" → ${outlet?.name ?? oid}`);
    return res.json(mapping);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete("/api/mappings/outlet-alias/:id", requireMaster, async (req, res) => {
  try {
    await prisma.outletAlias.delete({ where: { id: Number(req.params.id) } });
    await logActivity(req, "ALIAS_DELETE", `id=${req.params.id}`);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 8. IMPORTS & UPLOADS
// ==========================================

app.post("/api/import/preview", requireFeature("import"), upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "File wajib diupload." });
  try {
    const preview = await previewSalesFile(req.file.buffer);
    return res.json(preview);
  } catch (err: any) {
    return res.status(422).json({ error: err.message || "Gagal membaca file Excel." });
  }
});

app.post("/api/import", requireFeature("import"), upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "File wajib diupload." });
  try {
    let forceImportHashes: string[] = [];
    if (req.body.forceImportHashes) {
      const parsed = JSON.parse(req.body.forceImportHashes);
      if (!Array.isArray(parsed) || parsed.length > 500) {
        return res.status(400).json({ error: "forceImportHashes tidak valid." });
      }
      forceImportHashes = parsed.filter((h): h is string => typeof h === "string");
    }
    const branch = (req.body.branch === "CIMAHI" ? "CIMAHI" : "BANDUNG") as "BANDUNG" | "CIMAHI";
    const summary = await importSalesFile(req.file.originalname, req.file.buffer, forceImportHashes, branch);
    invalidateDefaults();
    await logActivity(req, "IMPORT_SALES", `[${branch}] ${req.file.originalname} — ${summary.insertedCount} baris diimpor`);
    return res.json(summary);
  } catch (err: any) {
    return res.status(422).json({ error: err.message || "Gagal mengimpor file." });
  }
});

app.get("/api/imports", requireFeature("import"), async (req, res) => {
  try {
    const batches = await prisma.importBatch.findMany({
      orderBy: { uploadedAt: "desc" },
    });
    return res.json(
      batches.map((b) => ({
        ...b,
        uploadedAt: b.uploadedAt.toISOString(),
        periodStart: b.periodStart ? b.periodStart.toISOString() : null,
        periodEnd: b.periodEnd ? b.periodEnd.toISOString() : null,
      }))
    );
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/imports/:id", requireFeature("import"), async (req, res) => {
  try {
    const batch = await prisma.importBatch.findUnique({
      where: { id: Number(req.params.id) },
    });
    if (!batch) return res.status(404).json({ error: "Batch tidak ditemukan." });
    return res.json(batch);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete("/api/imports/:id", requireFeature("import"), async (req, res) => {
  try {
    await prisma.importBatch.delete({
      where: { id: Number(req.params.id) },
    });
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/import/tartun", requireFeature("import"), upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "File wajib diupload." });
  const dateStr = req.body.date;
  if (!dateStr) return res.status(400).json({ error: "Tanggal wajib diisi." });
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return res.status(400).json({ error: "Tanggal tidak valid." });
  }

  try {
    const { rows, errors } = parseTartunBuffer(req.file.buffer);
    const summary = await importDailyMetric("TARTUN", date, rows);
    return res.json({
      filename: req.file.originalname,
      parsedRows: rows.length,
      parseErrors: errors,
      ...summary,
    });
  } catch (err: any) {
    return res.status(422).json({ error: err.message || "Gagal memproses file Tarik Tunai." });
  }
});

app.post("/api/import/server", requireFeature("import"), upload.single("file"), async (req, res) => {
  const dateStr = req.body.date;
  if (!dateStr) return res.status(400).json({ error: "Tanggal wajib diisi." });
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return res.status(400).json({ error: "Tanggal tidak valid." });
  }

  try {
    let rows: any[] = [];
    let errors: any[] = [];
    let filename = "teks tempel";

    if (req.file) {
      const parsed = parseServerBuffer(req.file.buffer);
      rows = parsed.rows;
      errors = parsed.errors;
      filename = req.file.originalname;
    } else if (req.body.text && typeof req.body.text === "string" && req.body.text.trim()) {
      const parsed = parseServerText(req.body.text);
      rows = parsed.rows;
      errors = parsed.errors;
    } else {
      return res.status(400).json({ error: "Isi teks atau unggah file terlebih dahulu." });
    }

    const summary = await importDailyMetric("SERVER", date, rows);
    return res.json({
      filename,
      parsedRows: rows.length,
      parseErrors: errors,
      ...summary,
    });
  } catch (err: any) {
    return res.status(422).json({ error: err.message || "Gagal memproses file Server." });
  }
});

// ==========================================
// 9. DAILY IMPORT HISTORY (TARTUN & SERVER)
// ==========================================

app.get("/api/daily-imports/tartun", requireFeature("import"), async (req, res) => {
  try {
    const rows = await prisma.tartunDaily.groupBy({
      by: ["tanggal"],
      _count: { id: true },
      _sum: { sales: true, trx: true },
      _max: { updatedAt: true },
      orderBy: { tanggal: "desc" },
    });
    return res.json(
      rows.map((r) => ({
        tanggal: r.tanggal.toISOString().slice(0, 10),
        outletCount: r._count.id,
        totalSales: Number(r._sum.sales ?? 0),
        totalTrx: r._sum.trx ?? 0,
        updatedAt: r._max.updatedAt?.toISOString() ?? null,
      }))
    );
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete("/api/daily-imports/tartun/:date", requireFeature("import"), async (req, res) => {
  try {
    const date = new Date(String(req.params.date));
    if (Number.isNaN(date.getTime())) return res.status(400).json({ error: "Tanggal tidak valid." });
    const { count } = await prisma.tartunDaily.deleteMany({
      where: { tanggal: { gte: date, lt: new Date(date.getTime() + 86400000) } },
    });
    return res.json({ ok: true, deletedCount: count });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/daily-imports/server", requireFeature("import"), async (req, res) => {
  try {
    const rows = await prisma.serverDaily.groupBy({
      by: ["tanggal"],
      _count: { id: true },
      _sum: { sales: true, trx: true },
      _max: { updatedAt: true },
      orderBy: { tanggal: "desc" },
    });
    return res.json(
      rows.map((r) => ({
        tanggal: r.tanggal.toISOString().slice(0, 10),
        outletCount: r._count.id,
        totalSales: Number(r._sum.sales ?? 0),
        totalTrx: r._sum.trx ?? 0,
        updatedAt: r._max.updatedAt?.toISOString() ?? null,
      }))
    );
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete("/api/daily-imports/server/:date", requireFeature("import"), async (req, res) => {
  try {
    const date = new Date(String(req.params.date));
    if (Number.isNaN(date.getTime())) return res.status(400).json({ error: "Tanggal tidak valid." });
    const { count } = await prisma.serverDaily.deleteMany({
      where: { tanggal: { gte: date, lt: new Date(date.getTime() + 86400000) } },
    });
    return res.json({ ok: true, deletedCount: count });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 10. ACTIVITY LOG
// ==========================================

app.get("/api/activity-log", requireFeature("activity_log"), async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const offset = Number(req.query.offset) || 0;
    const role = typeof req.query.role === "string" && req.query.role ? req.query.role : undefined;
    const from = parseDateParam(req.query.from);
    const to = parseDateParam(req.query.to);

    const where: Record<string, unknown> = {};
    if (role) where.role = role;
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: new Date(to.getTime() + 86400000) } : {}),
      };
    }

    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.activityLog.count({ where }),
    ]);

    return res.json({ logs, total, limit, offset });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 11. PRODUCTION STATIC SPA SERVING
// ==========================================

const distPath = path.resolve(process.cwd(), "dist");
app.use(express.static(distPath));

// Fallback all non-API routes to index.html for SPA client-side routing
app.use((req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "Endpoint not found" });
  }
  return res.sendFile(path.join(distPath, "index.html"));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
