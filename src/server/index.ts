// ==========================================
// APP ENTRYPOINT — Express app setup (security/parsing middleware), router
// wiring, startup bootstrap, and production static-SPA serving.
//
// All actual route handlers live in src/server/routes/*.ts, one file per
// domain (auth, dashboard, points, target, imports, ...). Each router
// registers its own full "/api/..." paths, so it's mounted here with a plain
// `app.use(router)` — no path prefix to keep in sync by hand. Shared guards
// (requireAuth/requireMaster/requireFeature), logging, and rate limiters live
// in ./middleware.ts; file-upload configs live in ./uploads.ts.
//
// To add a new endpoint: put it in the router for its domain (or add a new
// router file + `app.use(...)` below for a new domain). See BLUEPRINT.md
// §"Peta modul server" for the full module map.
// ==========================================
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import compression from "compression";
import path from "node:path";
import { ensureDefaults } from "../lib/ensureDefaults";
import { purgeExpiredSessions } from "../lib/session";
import { ensureAuthBootstrap } from "../lib/queries/users";

import { authRouter } from "./routes/auth";
import { accountsRouter } from "./routes/accounts";
import { rolesRouter } from "./routes/roles";
import { backupRouter } from "./routes/backup";
import { dashboardRouter } from "./routes/dashboard";
import { outletsRouter } from "./routes/outlets";
import { employeesRouter } from "./routes/employees";
import { itemsRouter } from "./routes/items";
import { salesRouter } from "./routes/sales";
import { dataExplorerRouter } from "./routes/dataExplorer";
import { targetRouter } from "./routes/target";
import { pointsRouter } from "./routes/points";
import { publicPointsRouter } from "./routes/publicPoints";
import { mappingsRouter } from "./routes/mappings";
import { importsRouter } from "./routes/imports";
import { masterItemsRouter } from "./routes/masterItems";
import { activityLogRouter } from "./routes/activityLog";

const app = express();

// Security headers
app.use(helmet({ contentSecurityPolicy: false }));

// Gzip every text response (JSON API responses, the SPA's JS/CSS bundle) —
// biggest win per line of code: this app's JSON payloads compress ~5-10×
// since they're repetitive tabular data (outlet names, dates, etc).
app.use(compression());

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

// Initialize defaults on server startup
ensureDefaults().catch((err) => console.error("ensureDefaults error:", err));
ensureAuthBootstrap().catch((err) => console.error("ensureAuthBootstrap error:", err));

// Keep the sessions table from growing without bound.
purgeExpiredSessions().catch(() => {});
setInterval(() => {
  purgeExpiredSessions().catch(() => {});
}, 6 * 60 * 60 * 1000).unref();

// ==========================================
// ROUTERS — order doesn't affect matching since every route below carries a
// distinct, already-complete path; grouped here to mirror the module map.
// ==========================================
app.use(authRouter);
app.use(accountsRouter);
app.use(rolesRouter);
app.use(backupRouter);
app.use(dashboardRouter);
app.use(outletsRouter);
app.use(employeesRouter);
app.use(itemsRouter);
app.use(salesRouter);
app.use(dataExplorerRouter);
app.use(targetRouter);
app.use(pointsRouter);
app.use(publicPointsRouter);
app.use(mappingsRouter);
app.use(importsRouter);
app.use(masterItemsRouter);
app.use(activityLogRouter);

// ==========================================
// PRODUCTION STATIC SPA SERVING
// ==========================================

const distPath = path.resolve(process.cwd(), "dist");
app.use(
  express.static(distPath, {
    // Vite hashes every built filename (index-<hash>.js) — safe to cache
    // for a year, since a new deploy always produces new filenames.
    // index.html itself is the one exception: it's the only unhashed file,
    // and it's what points browsers at the current hashed bundle, so it must
    // always be revalidated (handled explicitly below either way).
    maxAge: "1y",
    immutable: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith("index.html")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  })
);

// Fallback all non-API routes to index.html for SPA client-side routing
app.use((req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ error: "Endpoint not found" });
  }
  return res.sendFile(path.join(distPath, "index.html"), {
    headers: { "Cache-Control": "no-cache" },
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
