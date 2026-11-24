// ==========================================
// AUTHENTICATION — login, logout, current session, own password change.
// Mounted at the app root in src/server/index.ts (routes below already carry
// their full /api/auth/* path).
// ==========================================
import { Router } from "express";
import { prisma } from "../../lib/prisma";
import {
  verifyEnvPassword,
  createSession,
  verifySessionToken,
  revokeSessionByToken,
  COOKIE_NAME,
  SESSION_DURATION_MS,
  type UserRole,
} from "../../lib/session";
import { verifyPasswordHash, fakeVerifyDelay } from "../../lib/password";
import { changeOwnPassword, UserError } from "../../lib/queries/users";
import {
  submitPasswordResetRequest,
  redeemPasswordReset,
  getMasterRecoveryCodeStatus,
  regenerateMasterRecoveryCodes,
  PasswordResetError,
} from "../../lib/queries/passwordReset";
import { resolveUserPermissions } from "../../lib/permissions";
import {
  loginLimiter,
  passwordChangeLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter,
  requireAuth,
  requireMaster,
  sendError,
  clientIp,
  logActivity,
  SESSION_COOKIE_OPTIONS,
} from "../middleware";

export const authRouter = Router();

authRouter.post("/api/auth/login", loginLimiter, async (req, res) => {
  const rawUsername = String(req.body?.username ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  const ip = clientIp(req);
  const userAgent = typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null;

  // One message for every failure mode — never reveal whether a username exists.
  const reject = () => res.status(401).json({ error: "Username atau kata sandi salah." });

  if (!password || !rawUsername) {
    await fakeVerifyDelay(password);
    return reject();
  }

  try {
    const account = await prisma.user.findUnique({
      where: { username: rawUsername },
      select: { id: true, username: true, passwordHash: true, role: true, isActive: true },
    });

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
        prisma.activityLog
          .create({ data: { role: rawUsername, action: "LOGIN_GAGAL", detail: "Akun nonaktif", ip } })
          .catch(() => {});
        return res.status(403).json({ error: "Akun dinonaktifkan. Hubungi pemilik akun master." });
      }
      if (account.role !== "master" && account.role !== "admin") return reject();
      resolved = { role: account.role, username: account.username, userId: account.id };
    } else {
      // Break-glass env-var passwords: only active when explicitly enabled or
      // when no active DB account for that role exists yet, and username must
      // explicitly match the target role.
      const envRole = verifyEnvPassword(password);
      let envAllowed = false;
      if (envRole && rawUsername === envRole) {
        if (process.env.ALLOW_ENV_BREAKGLASS === "true") {
          envAllowed = true;
        } else {
          const activeRoleCount = await prisma.user.count({
            where: { role: envRole, isActive: true },
          });
          envAllowed = activeRoleCount === 0;
        }
      }
      if (!envRole || !envAllowed) {
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

authRouter.post("/api/auth/logout", async (req, res) => {
  await revokeSessionByToken(req.cookies[COOKIE_NAME]).catch(() => {});
  res.clearCookie(COOKIE_NAME, { path: "/" });
  return res.json({ ok: true });
});

authRouter.get("/api/auth/me", async (req, res) => {
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

authRouter.post("/api/auth/change-password", passwordChangeLimiter, requireAuth, async (req, res) => {
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

authRouter.post("/api/auth/forgot-password", forgotPasswordLimiter, async (req, res) => {
  const ip = clientIp(req);
  const rawUsername = String(req.body?.username ?? "").trim().toLowerCase();
  try {
    const result = await submitPasswordResetRequest({
      username: rawUsername,
      note: req.body?.note,
      ip,
    });
    if (!result.recorded) {
      await fakeVerifyDelay(rawUsername || "forgot");
    } else {
      prisma.activityLog
        .create({
          data: {
            role: result.username ?? rawUsername,
            action: "MINTA_RESET_PASSWORD",
            ip,
          },
        })
        .catch(() => {});
    }
    return res.json({
      ok: true,
      message:
        "Permintaan telah dicatat. Jika username terdaftar dan aktif, hubungi pemilik akun master untuk mendapatkan kode reset.",
    });
  } catch (err) {
    return sendError(res, 500, err, "Gagal memproses permintaan reset kata sandi.");
  }
});

authRouter.post("/api/auth/reset-password", resetPasswordLimiter, async (req, res) => {
  const ip = clientIp(req);
  const rawUsername = String(req.body?.username ?? "").trim().toLowerCase();
  try {
    const result = await redeemPasswordReset({
      username: rawUsername,
      code: req.body?.code,
      newPassword: req.body?.newPassword,
    });
    res.clearCookie(COOKIE_NAME, { path: "/" });
    prisma.activityLog
      .create({
        data: {
          role: `${result.role}:${result.username}`,
          action:
            result.method === "recovery_code"
              ? "RESET_PASSWORD_RECOVERY_MASTER"
              : "RESET_PASSWORD_DENGAN_KODE",
          ip,
        },
      })
      .catch(() => {});
    return res.json({ ok: true });
  } catch (err) {
    if (err instanceof PasswordResetError) {
      if (rawUsername) {
        prisma.activityLog
          .create({ data: { role: rawUsername, action: "RESET_PASSWORD_GAGAL", ip } })
          .catch(() => {});
      }
      return res.status(err.status).json({ error: err.message });
    }
    return sendError(res, 500, err, "Gagal mereset kata sandi.");
  }
});

authRouter.get("/api/auth/recovery-codes/status", requireMaster, async (req, res) => {
  if (req.session!.userId === null) {
    return res.json({ supported: false, total: 0, remaining: 0, lastGeneratedAt: null });
  }
  try {
    const status = await getMasterRecoveryCodeStatus(req.session!.userId);
    return res.json({ supported: true, ...status });
  } catch (err) {
    return sendError(res, 500, err, "Gagal memuat status kode pemulihan.");
  }
});

authRouter.post("/api/auth/recovery-codes/regenerate", passwordChangeLimiter, requireMaster, async (req, res) => {
  if (req.session!.userId === null) {
    return res.status(400).json({
      error: "Sesi ini memakai kata sandi environment, bukan akun database.",
    });
  }
  try {
    const result = await regenerateMasterRecoveryCodes(
      req.session!.userId,
      req.body?.currentPassword,
    );
    await logActivity(req, "BUAT_KODE_PEMULIHAN_MASTER");
    return res.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof PasswordResetError) {
      return res.status(err.status).json({ error: err.message });
    }
    return sendError(res, 500, err, "Gagal membuat kode pemulihan master.");
  }
});
