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
import { resolveUserPermissions } from "../../lib/permissions";
import { loginLimiter, requireAuth, sendError, clientIp, logActivity, SESSION_COOKIE_OPTIONS } from "../middleware";

export const authRouter = Router();

authRouter.post("/api/auth/login", loginLimiter, async (req, res) => {
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

authRouter.post("/api/auth/change-password", requireAuth, async (req, res) => {
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
