// ==========================================
// TARGET & HOURLY REPORTS — Laporan Target Harian (single date or range),
// editable target amounts, and Jam Operasional.
// ==========================================
import { Router, type Request } from "express";
import { getTargetReport, getTargetAmounts, setTargetAmount, type TargetAmounts } from "../../lib/queries/targetReport";
import { getHourlyAnalytics, type Granularity } from "../../lib/queries/hourly";
import { type FeatureKey } from "../../lib/features";
import type { BusinessLine } from "@/generated/prisma/client";
import { requireFeature, requireMaster, logActivity } from "../middleware";

export const targetRouter = Router();

const targetReportFeature = (req: Request): FeatureKey =>
  req.query.branch === "CIMAHI" ? "target_cimahi" : "target_bandung";

targetRouter.get("/api/target/report", requireFeature(targetReportFeature), async (req, res) => {
  try {
    // Accepts a `from`/`to` range; `date` alone is still honoured (from == to)
    // so existing links and the Analitik page keep working unchanged.
    const fromParam = (req.query.from as string) || (req.query.date as string);
    const toParam = (req.query.to as string) || (req.query.date as string);
    const from = fromParam ? new Date(fromParam) : null;
    const to = toParam ? new Date(toParam) : null;
    if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return res.status(400).json({ error: "Parameter tanggal wajib diisi (YYYY-MM-DD)." });
    }
    if (from.getTime() > to.getTime()) {
      return res.status(400).json({ error: "Tanggal 'dari' tidak boleh setelah tanggal 'sampai'." });
    }
    const branch = (req.query.branch === "CIMAHI" ? "CIMAHI" : "BANDUNG") as "BANDUNG" | "CIMAHI";
    const [report, dailyTargets] = await Promise.all([
      getTargetReport(from, to, branch),
      getTargetAmounts(branch),
    ]);

    // Targets are stored per-day; scale them to the selected period so every
    // pass/fail highlight and achievement % on the report compares like with
    // like. dayCount === 1 for a single date -> identical to before.
    const n = report.dayCount;
    const scale = (t: TargetAmounts): TargetAmounts => ({
      SERVER: t.SERVER * n,
      TARTUN: t.TARTUN * n,
      PETSHOP: t.PETSHOP * n,
      AKSESORIS: t.AKSESORIS * n,
      SP_VOUCHER: t.SP_VOUCHER * n,
    });

    return res.json({
      date: fromParam === toParam ? fromParam : undefined,
      from: fromParam,
      to: toParam,
      dayCount: n,
      branch,
      rows: report.rows,
      unmappedItemGroups: report.unmappedItemGroups,
      targets: { perkonter: scale(dailyTargets.perkonter), all: scale(dailyTargets.all) },
      dailyTargets,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Master-only: this returns editable amounts and is consumed only by the
// Settings page's target-editing forms, not the (feature-gated) report pages.
targetRouter.get("/api/target", requireMaster, async (req, res) => {
  try {
    const branch = (req.query.branch === "CIMAHI" ? "CIMAHI" : "BANDUNG") as "BANDUNG" | "CIMAHI";
    const targets = await getTargetAmounts(branch);
    return res.json(targets);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

targetRouter.put("/api/target", requireMaster, async (req, res) => {
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

targetRouter.post("/api/target", requireMaster, async (req, res) => {
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

targetRouter.get("/api/hourly", requireFeature(targetReportFeature), async (req, res) => {
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
    const branch = req.query.branch === "CIMAHI" ? "CIMAHI" : "BANDUNG";
    const report = await getHourlyAnalytics(date, outletId, granularity, branch);
    return res.json(report);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
