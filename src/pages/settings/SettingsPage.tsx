import { useCallback, useEffect, useMemo, useState } from "react";
import { formatNumber, formatRupiah } from "@/lib/format";

type BusinessLine = "SERVER" | "TARTUN" | "PETSHOP" | "AKSESORIS" | "SP_VOUCHER";
type ReportCategory = "PETSHOP" | "AKSESORIS" | "SP_VOUCHER";

const LINE_LABELS: Record<BusinessLine, string> = {
  SERVER: "Server",
  TARTUN: "Tartun",
  PETSHOP: "Petshop",
  AKSESORIS: "Aksesoris",
  SP_VOUCHER: "SP / Voucher",
};
const LINES: BusinessLine[] = ["SERVER", "TARTUN", "PETSHOP", "AKSESORIS", "SP_VOUCHER"];
const CATEGORIES: ReportCategory[] = ["PETSHOP", "AKSESORIS", "SP_VOUCHER"];

interface Amounts extends Record<BusinessLine, number> {}
interface OutletItem {
  id: number;
  name: string;
  isHidden?: boolean;
  qty?: number;
  subtotal?: number;
  transactionCount?: number;
}
interface EmployeeItem {
  id: number;
  name: string;
  isHidden?: boolean;
  qty?: number;
  subtotal?: number;
  transactionCount?: number;
}
interface AliasRow {
  id: number;
  alias: string;
  outletId: number;
  outletName: string;
  isDefault: boolean;
}
interface GroupRow {
  id: number;
  itemGroup: string;
  category: ReportCategory;
  isDefault: boolean;
}

// Points Types
interface ItemPointRule {
  id: number;
  pattern: string;
  points: number;
  isDefault: boolean;
}
interface GroupPointRule {
  id: number;
  itemGroup: string;
  points: number;
}
interface ExcludedEmployee {
  id: number;
  employeeId: number;
  employeeName: string;
  reason: string | null;
}
interface ItemExclusion {
  id: number;
  pattern: string;
}

export function SettingsPage() {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  function toggleSection(id: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ========================================================
  // 1. STATE FOR TARGET SETTINGS
  // ========================================================
  const [perkonter, setPerkonter] = useState<Amounts | null>(null);
  const [all, setAll] = useState<Amounts | null>(null);
  const [targetBusy, setTargetBusy] = useState(false);
  const [targetSaved, setTargetSaved] = useState(false);

  const [aliases, setAliases] = useState<AliasRow[]>([]);
  const [aliasFrom, setAliasFrom] = useState("");
  const [aliasTo, setAliasTo] = useState<string>("");
  const [aliasError, setAliasError] = useState<string | null>(null);

  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [groupFrom, setGroupFrom] = useState("");
  const [groupTo, setGroupTo] = useState<ReportCategory>("AKSESORIS");
  const [groupError, setGroupError] = useState<string | null>(null);

  const loadTargets = useCallback(async () => {
    try {
      const res = await fetch("/api/target");
      if (res.ok) {
        const data = await res.json();
        setPerkonter(data.perkonter);
        setAll(data.all);
      }
    } catch {
      // ignore
    }
  }, []);

  const loadAliases = useCallback(async () => {
    try {
      const res = await fetch("/api/mappings/outlet-alias");
      if (res.ok) setAliases(await res.json());
    } catch {
      // ignore
    }
  }, []);

  const loadGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/mappings/item-group");
      if (res.ok) setGroups(await res.json());
    } catch {
      // ignore
    }
  }, []);

  // ========================================================
  // 2. STATE FOR POINTS SETTINGS
  // ========================================================
  const [itemRules, setItemRules] = useState<ItemPointRule[]>([]);
  const [patternInput, setPatternInput] = useState("");
  const [pointsInput, setPointsInput] = useState("10");
  const [itemError, setItemError] = useState<string | null>(null);

  const [groupRules, setGroupRules] = useState<GroupPointRule[]>([]);
  const [groupInput, setGroupInput] = useState("");
  const [groupPointsInput, setGroupPointsInput] = useState("5");
  const [groupRuleError, setGroupRuleError] = useState<string | null>(null);

  const [periodStartDay, setPeriodStartDay] = useState("1");
  const [periodBusy, setPeriodBusy] = useState(false);
  const [periodSaved, setPeriodSaved] = useState(false);

  const [excluded, setExcluded] = useState<ExcludedEmployee[]>([]);
  const [excludeEmployeeId, setExcludeEmployeeId] = useState("");
  const [excludeReason, setExcludeReason] = useState("");
  const [excludeError, setExcludeError] = useState<string | null>(null);

  const [itemExclusions, setItemExclusions] = useState<ItemExclusion[]>([]);
  const [itemExclusionInput, setItemExclusionInput] = useState("");
  const [itemExclusionError, setItemExclusionError] = useState<string | null>(null);

  const loadItemRules = useCallback(async () => {
    try {
      const res = await fetch("/api/points/items");
      if (res.ok) setItemRules(await res.json());
    } catch {
      // ignore
    }
  }, []);

  const loadGroupRules = useCallback(async () => {
    try {
      const res = await fetch("/api/points/group-defaults");
      if (res.ok) setGroupRules(await res.json());
    } catch {
      // ignore
    }
  }, []);

  const loadPeriodSetting = useCallback(async () => {
    try {
      const res = await fetch("/api/points/settings");
      if (res.ok) {
        const d = await res.json();
        setPeriodStartDay(String(d.periodStartDay));
      }
    } catch {
      // ignore
    }
  }, []);

  const loadExcluded = useCallback(async () => {
    try {
      const res = await fetch("/api/points/excluded-employees");
      if (res.ok) setExcluded(await res.json());
    } catch {
      // ignore
    }
  }, []);

  const loadItemExclusions = useCallback(async () => {
    try {
      const res = await fetch("/api/points/item-exclusions");
      if (res.ok) setItemExclusions(await res.json());
    } catch {
      // ignore
    }
  }, []);

  // ========================================================
  // 3. STATE FOR VISIBILITY SETTINGS (OUTLETS & EMPLOYEES)
  // ========================================================
  const [allOutlets, setAllOutlets] = useState<OutletItem[]>([]);
  const [allEmployees, setAllEmployees] = useState<EmployeeItem[]>([]);
  const [outletFilter, setOutletFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [visibilityBusyId, setVisibilityBusyId] = useState<string | null>(null);

  const loadAllOutlets = useCallback(async () => {
    try {
      const res = await fetch("/api/outlets?includeHidden=true");
      if (res.ok) {
        const data = await res.json();
        setAllOutlets(data);
      }
    } catch {
      // ignore
    }
  }, []);

  // Set aliasTo default after outlets load — separate from loadAllOutlets to avoid rebuild loop
  useEffect(() => {
    if (allOutlets.length > 0 && !aliasTo) {
      setAliasTo(String(allOutlets[0].id));
    }
  }, [allOutlets, aliasTo]);

  const loadAllEmployees = useCallback(async () => {
    try {
      const res = await fetch("/api/employees?includeHidden=true");
      if (res.ok) {
        const data = await res.json();
        setAllEmployees(data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    loadTargets();
    loadAliases();
    loadGroups();
    loadItemRules();
    loadGroupRules();
    loadPeriodSetting();
    loadExcluded();
    loadItemExclusions();
    loadAllOutlets();
    loadAllEmployees();
  }, [
    loadTargets,
    loadAliases,
    loadGroups,
    loadItemRules,
    loadGroupRules,
    loadPeriodSetting,
    loadExcluded,
    loadItemExclusions,
    loadAllOutlets,
    loadAllEmployees,
  ]);

  // Target Handlers
  async function saveTargets() {
    if (!perkonter || !all) return;
    setTargetBusy(true);
    setTargetSaved(false);
    const payload = [
      ...LINES.map((c) => ({ scope: "PERKONTER", category: c, amount: perkonter[c] })),
      ...LINES.map((c) => ({ scope: "ALL", category: c, amount: all[c] })),
    ];
    try {
      const res = await fetch("/api/target", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setTargetSaved(true);
        setTimeout(() => setTargetSaved(false), 2500);
      }
    } finally {
      setTargetBusy(false);
    }
  }

  async function addAlias() {
    setAliasError(null);
    const alias = aliasFrom.trim();
    if (!alias) {
      setAliasError("Isi nama alias terlebih dahulu.");
      return;
    }
    try {
      const res = await fetch("/api/mappings/outlet-alias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias, outletId: Number(aliasTo) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAliasError(data.error ?? "Gagal menyimpan.");
        return;
      }
      setAliasFrom("");
      await loadAliases();
    } catch {
      setAliasError("Terjadi kesalahan jaringan.");
    }
  }

  async function deleteAlias(id: number) {
    try {
      await fetch(`/api/mappings/outlet-alias/${id}`, { method: "DELETE" });
      await loadAliases();
    } catch {
      // ignore
    }
  }

  async function addGroup() {
    setGroupError(null);
    const itemGroup = groupFrom.trim();
    if (!itemGroup) {
      setGroupError("Isi nama Item Group terlebih dahulu.");
      return;
    }
    try {
      const res = await fetch("/api/mappings/item-group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemGroup, category: groupTo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGroupError(data.error ?? "Gagal menyimpan.");
        return;
      }
      setGroupFrom("");
      await loadGroups();
    } catch {
      setGroupError("Terjadi kesalahan jaringan.");
    }
  }

  async function deleteGroup(id: number) {
    try {
      await fetch(`/api/mappings/item-group/${id}`, { method: "DELETE" });
      await loadGroups();
    } catch {
      // ignore
    }
  }

  // Points Handlers
  async function savePeriodSetting() {
    const day = Number(periodStartDay);
    setPeriodBusy(true);
    setPeriodSaved(false);
    try {
      const res = await fetch("/api/points/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodStartDay: day }),
      });
      if (res.ok) {
        setPeriodSaved(true);
        setTimeout(() => setPeriodSaved(false), 2500);
      }
    } finally {
      setPeriodBusy(false);
    }
  }

  async function addExclusion() {
    setExcludeError(null);
    if (!excludeEmployeeId) {
      setExcludeError("Pilih pegawai terlebih dahulu.");
      return;
    }
    try {
      const res = await fetch("/api/points/excluded-employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: Number(excludeEmployeeId),
          reason: excludeReason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setExcludeError(data.error ?? "Gagal menyimpan.");
        return;
      }
      setExcludeEmployeeId("");
      setExcludeReason("");
      await loadExcluded();
    } catch {
      setExcludeError("Terjadi kesalahan jaringan.");
    }
  }

  async function removeExclusion(id: number) {
    try {
      await fetch(`/api/points/excluded-employees/${id}`, { method: "DELETE" });
      await loadExcluded();
    } catch {
      // ignore
    }
  }

  const excludableEmployees = useMemo(
    () => allEmployees.filter((e) => !excluded.some((x) => x.employeeId === e.id)),
    [allEmployees, excluded]
  );

  async function addItemRule() {
    setItemError(null);
    const pattern = patternInput.trim();
    const points = Number(pointsInput);
    if (!pattern) {
      setItemError("Isi nama/pola item terlebih dahulu.");
      return;
    }
    if (!Number.isInteger(points) || points < 0) {
      setItemError("Poin harus angka bulat, 0 atau lebih.");
      return;
    }
    try {
      const res = await fetch("/api/points/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pattern, points }),
      });
      const data = await res.json();
      if (!res.ok) {
        setItemError(data.error ?? "Gagal menyimpan.");
        return;
      }
      setPatternInput("");
      setPointsInput("10");
      await loadItemRules();
    } catch {
      setItemError("Terjadi kesalahan jaringan.");
    }
  }

  async function deleteItemRule(id: number) {
    try {
      await fetch(`/api/points/items/${id}`, { method: "DELETE" });
      await loadItemRules();
    } catch {
      // ignore
    }
  }

  async function addItemExclusion() {
    setItemExclusionError(null);
    const pattern = itemExclusionInput.trim();
    if (!pattern) {
      setItemExclusionError("Isi nama/pola item terlebih dahulu.");
      return;
    }
    try {
      const res = await fetch("/api/points/item-exclusions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pattern }),
      });
      const data = await res.json();
      if (!res.ok) {
        setItemExclusionError(data.error ?? "Gagal menyimpan.");
        return;
      }
      setItemExclusionInput("");
      await loadItemExclusions();
    } catch {
      setItemExclusionError("Terjadi kesalahan jaringan.");
    }
  }

  async function removeItemExclusion(id: number) {
    try {
      await fetch(`/api/points/item-exclusions/${id}`, { method: "DELETE" });
      await loadItemExclusions();
    } catch {
      // ignore
    }
  }

  async function addGroupRule() {
    setGroupRuleError(null);
    const itemGroup = groupInput.trim();
    const points = Number(groupPointsInput);
    if (!itemGroup) {
      setGroupRuleError("Isi nama Item Group terlebih dahulu.");
      return;
    }
    if (!Number.isInteger(points) || points < 0) {
      setGroupRuleError("Poin harus angka bulat, 0 atau lebih.");
      return;
    }
    try {
      const res = await fetch("/api/points/group-defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemGroup, points }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGroupRuleError(data.error ?? "Gagal menyimpan.");
        return;
      }
      setGroupInput("");
      setGroupPointsInput("5");
      await loadGroupRules();
    } catch {
      setGroupRuleError("Terjadi kesalahan jaringan.");
    }
  }

  async function deleteGroupRule(id: number) {
    try {
      await fetch(`/api/points/group-defaults/${id}`, { method: "DELETE" });
      await loadGroupRules();
    } catch {
      // ignore
    }
  }

  // Visibility Handlers
  async function toggleOutletVisibility(outlet: OutletItem) {
    const nextHidden = !outlet.isHidden;
    const key = `outlet-${outlet.id}`;
    setVisibilityBusyId(key);
    // Optimistic update
    setAllOutlets((prev) =>
      prev.map((o) => (o.id === outlet.id ? { ...o, isHidden: nextHidden } : o))
    );
    try {
      await fetch(`/api/outlets/${outlet.id}/visibility`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHidden: nextHidden }),
      });
    } catch {
      // Revert on error
      setAllOutlets((prev) =>
        prev.map((o) => (o.id === outlet.id ? { ...o, isHidden: outlet.isHidden } : o))
      );
    } finally {
      setVisibilityBusyId(null);
    }
  }

  async function toggleEmployeeVisibility(emp: EmployeeItem) {
    const nextHidden = !emp.isHidden;
    const key = `emp-${emp.id}`;
    setVisibilityBusyId(key);
    // Optimistic update
    setAllEmployees((prev) =>
      prev.map((e) => (e.id === emp.id ? { ...e, isHidden: nextHidden } : e))
    );
    try {
      await fetch(`/api/employees/${emp.id}/visibility`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHidden: nextHidden }),
      });
    } catch {
      // Revert on error
      setAllEmployees((prev) =>
        prev.map((e) => (e.id === emp.id ? { ...e, isHidden: emp.isHidden } : e))
      );
    } finally {
      setVisibilityBusyId(null);
    }
  }

  const filteredOutlets = useMemo(
    () => allOutlets.filter((o) => o.name.toLowerCase().includes(outletFilter.toLowerCase().trim())),
    [allOutlets, outletFilter]
  );
  const hiddenOutletCount = useMemo(
    () => allOutlets.filter((o) => o.isHidden).length,
    [allOutlets]
  );

  const filteredEmployees = useMemo(
    () => allEmployees.filter((e) => e.name.toLowerCase().includes(employeeFilter.toLowerCase().trim())),
    [allEmployees, employeeFilter]
  );
  const hiddenEmployeeCount = useMemo(
    () => allEmployees.filter((e) => e.isHidden).length,
    [allEmployees]
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="pb-3 border-b border-border/70">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Pusat Pengaturan Sistem</h1>
        <p className="text-xs text-muted mt-1 leading-relaxed">
          Kelola parameter nominal target penjualan, skema insentif poin staf, dan sembunyikan/tampilkan performa outlet &amp; karyawan secara terpusat.
        </p>
      </div>

      {/* ── 1. Nominal Target Harian ──────────────────────────── */}
      <div className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden">
        <button type="button" onClick={() => toggleSection("nominal-target")}
          className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-surface-hover/50 transition-colors">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
            <span className="text-sm font-bold uppercase tracking-wider text-foreground">Nominal Target Harian</span>
            <span className="text-[11px] font-mono text-muted bg-surface-subtle border border-border/60 rounded px-2 py-0.5">Target Harian</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            className={`shrink-0 text-muted transition-transform duration-200 ${openSections.has("nominal-target") ? "rotate-180" : ""}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {openSections.has("nominal-target") && (
          <div className="px-5 pb-5 pt-4 space-y-4 border-t border-border/60">
            <p className="text-xs text-muted leading-relaxed">
              <strong>Per Konter</strong> adalah batas kelulusan per cabang. <strong>Target ALL</strong> adalah total akumulasi seluruh outlet untuk menghitung persentase capaian.
            </p>
            {perkonter && all ? (
              <div className="space-y-4 pt-1">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-3 rounded-xl bg-surface-subtle/60 border border-border/60 p-4">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Target Per Konter (Rp / hari)
                    </h3>
                    {LINES.map((c) => (
                      <div key={c} className="flex items-center justify-between gap-3">
                        <label className="text-xs text-muted font-medium w-28">{LINE_LABELS[c]}</label>
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          value={perkonter[c]}
                          onChange={(e) =>
                            setPerkonter({ ...perkonter, [c]: Number(e.target.value) || 0 })
                          }
                          className="flex-1 max-w-44 rounded-lg border border-border/80 bg-surface px-3 py-1.5 text-xs font-mono text-foreground text-right focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3 rounded-xl bg-surface-subtle/60 border border-border/60 p-4">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Target ALL Jaringan (Rp / hari)
                    </h3>
                    {LINES.map((c) => (
                      <div key={c} className="flex items-center justify-between gap-3">
                        <label className="text-xs text-muted font-medium w-28">{LINE_LABELS[c]}</label>
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          value={all[c]}
                          onChange={(e) =>
                            setAll({ ...all, [c]: Number(e.target.value) || 0 })
                          }
                          className="flex-1 max-w-44 rounded-lg border border-border/80 bg-surface px-3 py-1.5 text-xs font-mono text-foreground text-right focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={saveTargets}
                    disabled={targetBusy}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-accent-foreground px-4 py-2 text-xs font-semibold hover:bg-accent-hover disabled:opacity-50 transition-all shadow-xs"
                  >
                    {targetBusy ? "Menyimpan..." : "Simpan Nominal Target"}
                  </button>
                  {targetSaved && (
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Target tersimpan
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted py-4">Memuat data target...</div>
            )}
          </div>
        )}
      </div>

      {/* ── 2. Pemetaan Kategori Item Group POS ──────────────── */}
      <div className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden">
        <button type="button" onClick={() => toggleSection("kategori-group")}
          className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-surface-hover/50 transition-colors">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-sm font-bold uppercase tracking-wider text-foreground">Pemetaan Kategori Item Group POS</span>
            <span className="text-[11px] font-mono text-muted bg-surface-subtle border border-border/60 rounded px-2 py-0.5">{groups.length} mapping</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            className={`shrink-0 text-muted transition-transform duration-200 ${openSections.has("kategori-group") ? "rotate-180" : ""}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {openSections.has("kategori-group") && (
          <div className="px-5 pb-5 pt-4 space-y-4 border-t border-border/60">
            <p className="text-xs text-muted leading-relaxed">
              Memetakan nilai <strong>Item Group</strong> mentah dari file POS ke dalam salah satu dari 3 kategori laporan: <strong>Petshop</strong>, <strong>Aksesoris</strong>, atau <strong>SP / Voucher</strong>.
            </p>
            <div className="flex flex-wrap items-end gap-3 pt-1">
              <div className="flex-1 min-w-56">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                  Item Group POS
                </label>
                <input
                  type="text"
                  value={groupFrom}
                  onChange={(e) => setGroupFrom(e.target.value)}
                  placeholder="Contoh: PETSHOP MAKANAN KUCING"
                  className="w-full rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                />
              </div>
              <div className="w-48">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                  Kategori Laporan
                </label>
                <select
                  value={groupTo}
                  onChange={(e) => setGroupTo(e.target.value as ReportCategory)}
                  className="w-full rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {LINE_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={addGroup}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-accent-foreground px-4 py-1.5 text-xs font-semibold hover:bg-accent-hover transition-all shadow-xs"
              >
                + Tambah Mapping
              </button>
            </div>
            {groupError && <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{groupError}</p>}
            <div className="overflow-x-auto rounded-xl border border-border/80 shadow-xs max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-surface-subtle/80 text-muted text-left sticky top-0 border-b border-border/80">
                  <tr>
                    <th className="px-4 py-2 font-semibold text-[11px] uppercase">Item Group POS</th>
                    <th className="px-4 py-2 font-semibold text-[11px] uppercase">Kategori Laporan</th>
                    <th className="px-4 py-2 font-semibold text-[11px] uppercase text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {groups.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-muted">
                        Belum ada mapping grup item.
                      </td>
                    </tr>
                  )}
                  {groups.map((g) => (
                    <tr key={g.id} className="hover:bg-surface-hover/70 transition-colors">
                      <td className="px-4 py-2 font-medium text-foreground">
                        {g.itemGroup}{" "}
                        {g.isDefault && (
                          <span className="text-[10px] text-accent bg-accent/10 px-1.5 py-0.5 rounded border border-accent/20 ml-1.5">
                            bawaan
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 font-semibold text-foreground">{LINE_LABELS[g.category]}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => deleteGroup(g.id)}
                          className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── 3. Pemetaan Alias Nama Outlet ─────────────────────── */}
      <div className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden">
        <button type="button" onClick={() => toggleSection("alias-outlet")}
          className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-surface-hover/50 transition-colors">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-500 shrink-0" />
            <span className="text-sm font-bold uppercase tracking-wider text-foreground">Pemetaan Alias Nama Outlet</span>
            <span className="text-[11px] font-mono text-muted bg-surface-subtle border border-border/60 rounded px-2 py-0.5">{aliases.length} alias</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            className={`shrink-0 text-muted transition-transform duration-200 ${openSections.has("alias-outlet") ? "rotate-180" : ""}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {openSections.has("alias-outlet") && (
          <div className="px-5 pb-5 pt-4 space-y-4 border-t border-border/60">
            <p className="text-xs text-muted leading-relaxed">
              Menghubungkan nama outlet / reseller yang tertulis di file Tarik Tunai atau Server ke nama outlet resmi.
            </p>
            <div className="flex flex-wrap items-end gap-3 pt-1">
              <div className="flex-1 min-w-56">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                  Nama Mentah di File (Alias)
                </label>
                <input
                  type="text"
                  value={aliasFrom}
                  onChange={(e) => setAliasFrom(e.target.value)}
                  placeholder="Contoh: PARENT-BEE-GODEAN"
                  className="w-full rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                />
              </div>
              <div className="w-48">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                  Outlet Tujuan
                </label>
                <select
                  value={aliasTo}
                  onChange={(e) => setAliasTo(e.target.value)}
                  className="w-full rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                >
                  {allOutlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={addAlias}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-accent-foreground px-4 py-1.5 text-xs font-semibold hover:bg-accent-hover transition-all shadow-xs"
              >
                + Tambah Alias
              </button>
            </div>
            {aliasError && <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{aliasError}</p>}
            <div className="overflow-x-auto rounded-xl border border-border/80 shadow-xs max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-surface-subtle/80 text-muted text-left sticky top-0 border-b border-border/80">
                  <tr>
                    <th className="px-4 py-2 font-semibold text-[11px] uppercase">Nama di File Excel</th>
                    <th className="px-4 py-2 font-semibold text-[11px] uppercase">Outlet Tujuan</th>
                    <th className="px-4 py-2 font-semibold text-[11px] uppercase text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {aliases.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-muted">
                        Belum ada alias outlet.
                      </td>
                    </tr>
                  )}
                  {aliases.map((a) => (
                    <tr key={a.id} className="hover:bg-surface-hover/70 transition-colors">
                      <td className="px-4 py-2 font-medium text-foreground">
                        {a.alias}{" "}
                        {a.isDefault && (
                          <span className="text-[10px] text-accent bg-accent/10 px-1.5 py-0.5 rounded border border-accent/20 ml-1.5">
                            bawaan
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 font-semibold text-foreground">{a.outletName}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => deleteAlias(a.id)}
                          className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── 4. Siklus Cut-off Periode Bulanan ─────────────────── */}
      <div className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden">
        <button type="button" onClick={() => toggleSection("siklus-periode")}
          className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-surface-hover/50 transition-colors">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
            <span className="text-sm font-bold uppercase tracking-wider text-foreground">Siklus Cut-off Periode Bulanan</span>
            <span className="text-[11px] font-mono text-muted bg-surface-subtle border border-border/60 rounded px-2 py-0.5">Tanggal {periodStartDay}</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            className={`shrink-0 text-muted transition-transform duration-200 ${openSections.has("siklus-periode") ? "rotate-180" : ""}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {openSections.has("siklus-periode") && (
          <div className="px-5 pb-5 pt-4 space-y-3 border-t border-border/60">
            <p className="text-xs text-muted leading-relaxed">
              Tentukan tanggal awal dimulainya siklus bulanan. Masukkan <strong>1</strong> untuk siklus kalender normal (1–akhir bulan), atau tanggal lain (contoh: <strong>29</strong> untuk periode 29 s/d 28 bulan berikutnya).
            </p>
            <div className="flex flex-wrap items-end gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                  Tanggal Mulai Siklus
                </label>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={periodStartDay}
                  onChange={(e) => setPeriodStartDay(e.target.value)}
                  className="w-28 rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                />
              </div>
              <button
                type="button"
                onClick={savePeriodSetting}
                disabled={periodBusy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-accent-foreground px-4 py-2 text-xs font-semibold hover:bg-accent-hover disabled:opacity-50 transition-all shadow-xs"
              >
                {periodBusy ? "Menyimpan..." : "Simpan Siklus"}
              </button>
              {periodSaved && (
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Siklus tersimpan
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 5. Pegawai Dikecualikan dari Poin ─────────────────── */}
      <div className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden">
        <button type="button" onClick={() => toggleSection("pegawai-dikecualikan")}
          className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-surface-hover/50 transition-colors">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
            <span className="text-sm font-bold uppercase tracking-wider text-foreground">Pegawai Dikecualikan dari Poin</span>
            <span className="text-[11px] font-mono text-muted bg-surface-subtle border border-border/60 rounded px-2 py-0.5">{excluded.length} dikecualikan</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            className={`shrink-0 text-muted transition-transform duration-200 ${openSections.has("pegawai-dikecualikan") ? "rotate-180" : ""}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {openSections.has("pegawai-dikecualikan") && (
          <div className="px-5 pb-5 pt-4 space-y-4 border-t border-border/60">
            <p className="text-xs text-muted leading-relaxed">
              Staf non-sales, admin, atau gudang yang tidak diikutsertakan dalam kompetisi leaderboard poin.
            </p>
            <div className="flex flex-wrap items-end gap-3 pt-1">
              <div className="flex-1 min-w-56">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                  Pilih Pegawai
                </label>
                <select
                  value={excludeEmployeeId}
                  onChange={(e) => setExcludeEmployeeId(e.target.value)}
                  className="w-full rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                >
                  <option value="">-- Pilih pegawai --</option>
                  {excludableEmployees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-56">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                  Alasan Pengecualian (opsional)
                </label>
                <input
                  type="text"
                  value={excludeReason}
                  onChange={(e) => setExcludeReason(e.target.value)}
                  placeholder="Contoh: Admin Gudang / IT Support"
                  className="w-full rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                />
              </div>
              <button
                type="button"
                onClick={addExclusion}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-accent-foreground px-4 py-1.5 text-xs font-semibold hover:bg-accent-hover transition-all shadow-xs"
              >
                + Kecualikan
              </button>
            </div>
            {excludeError && <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{excludeError}</p>}
            <div className="overflow-x-auto rounded-xl border border-border/80 shadow-xs max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-surface-subtle/80 text-muted text-left sticky top-0 border-b border-border/80">
                  <tr>
                    <th className="px-4 py-2 font-semibold text-[11px] uppercase">Nama Pegawai</th>
                    <th className="px-4 py-2 font-semibold text-[11px] uppercase">Alasan</th>
                    <th className="px-4 py-2 font-semibold text-[11px] uppercase text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {excluded.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-muted">
                        Tidak ada pegawai yang dikecualikan.
                      </td>
                    </tr>
                  )}
                  {excluded.map((x) => (
                    <tr key={x.id} className="hover:bg-surface-hover/70 transition-colors">
                      <td className="px-4 py-2 font-semibold text-foreground">{x.employeeName}</td>
                      <td className="px-4 py-2 text-muted">{x.reason || "-"}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeExclusion(x.id)}
                          className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                        >
                          Sertakan Lagi
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── 6. Poin Khusus per Item / SKU ─────────────────────── */}
      <div className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden">
        <button type="button" onClick={() => toggleSection("poin-per-item")}
          className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-surface-hover/50 transition-colors">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
            <span className="text-sm font-bold uppercase tracking-wider text-foreground">Poin Khusus per Item / SKU</span>
            <span className="text-[11px] font-mono text-muted bg-surface-subtle border border-border/60 rounded px-2 py-0.5">{itemRules.length} aturan</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            className={`shrink-0 text-muted transition-transform duration-200 ${openSections.has("poin-per-item") ? "rotate-180" : ""}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {openSections.has("poin-per-item") && (
          <div className="px-5 pb-5 pt-4 space-y-4 border-t border-border/60">
            <p className="text-xs text-muted leading-relaxed">
              Pola pencocokan nama item POS secara case-insensitive dan mencakup semua varian warna (contoh: <code>&quot;TWS Robot Airbuds T70E&quot;</code>). Jika ada pola bertumpuk, pola yang lebih spesifik / panjang akan diutamakan.
            </p>
            <div className="flex flex-wrap items-end gap-3 pt-1">
              <div className="flex-1 min-w-56">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                  Nama / Pola Item
                </label>
                <input
                  type="text"
                  value={patternInput}
                  onChange={(e) => setPatternInput(e.target.value)}
                  placeholder="Contoh: TWS Robot Airbuds T70E"
                  className="w-full rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                />
              </div>
              <div className="w-32">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                  Poin / pcs
                </label>
                <input
                  type="number"
                  value={pointsInput}
                  min={0}
                  step={1}
                  onChange={(e) => setPointsInput(e.target.value)}
                  className="w-full rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                />
              </div>
              <button
                type="button"
                onClick={addItemRule}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-accent-foreground px-4 py-1.5 text-xs font-semibold hover:bg-accent-hover transition-all shadow-xs"
              >
                + Tambah Aturan
              </button>
            </div>
            {itemError && <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{itemError}</p>}
            <div className="overflow-x-auto rounded-xl border border-border/80 shadow-xs max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-surface-subtle/80 text-muted text-left sticky top-0 border-b border-border/80">
                  <tr>
                    <th className="px-4 py-2 font-semibold text-[11px] uppercase">Nama / Pola Item</th>
                    <th className="px-4 py-2 font-semibold text-[11px] uppercase text-right">Poin / pcs</th>
                    <th className="px-4 py-2 font-semibold text-[11px] uppercase text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-mono">
                  {itemRules.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-muted font-sans">
                        Belum ada aturan khusus item.
                      </td>
                    </tr>
                  )}
                  {itemRules.map((r) => (
                    <tr key={r.id} className="hover:bg-surface-hover/70 transition-colors">
                      <td className="px-4 py-2 font-sans font-medium text-foreground">
                        {r.pattern}{" "}
                        {r.isDefault && (
                          <span className="text-[10px] text-accent bg-accent/10 px-1.5 py-0.5 rounded border border-accent/20 ml-1.5">
                            bawaan
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right text-accent font-bold">+{formatNumber(r.points)}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => deleteItemRule(r.id)}
                          className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline font-sans"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── 7. Item Dikecualikan dari Poin ────────────────────── */}
      <div className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden">
        <button type="button" onClick={() => toggleSection("item-dikecualikan")}
          className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-surface-hover/50 transition-colors">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
            <span className="text-sm font-bold uppercase tracking-wider text-foreground">Item Dikecualikan dari Poin</span>
            <span className="text-[11px] font-mono text-muted bg-surface-subtle border border-border/60 rounded px-2 py-0.5">{itemExclusions.length} item</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            className={`shrink-0 text-muted transition-transform duration-200 ${openSections.has("item-dikecualikan") ? "rotate-180" : ""}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {openSections.has("item-dikecualikan") && (
          <div className="px-5 pb-5 pt-4 space-y-4 border-t border-border/60">
            <p className="text-xs text-muted leading-relaxed">
              Item yang diblokir dari perolehan poin meskipun tergolong kategori berpoin.
            </p>
            <div className="flex flex-wrap items-end gap-3 pt-1">
              <div className="flex-1 min-w-56">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                  Nama / Pola Item
                </label>
                <input
                  type="text"
                  value={itemExclusionInput}
                  onChange={(e) => setItemExclusionInput(e.target.value)}
                  placeholder="Contoh: Kabel Data ufone CB01-M"
                  className="w-full rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                />
              </div>
              <button
                type="button"
                onClick={addItemExclusion}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-accent-foreground px-4 py-1.5 text-xs font-semibold hover:bg-accent-hover transition-all shadow-xs"
              >
                + Kecualikan Item
              </button>
            </div>
            {itemExclusionError && <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{itemExclusionError}</p>}
            <div className="overflow-x-auto rounded-xl border border-border/80 shadow-xs max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-surface-subtle/80 text-muted text-left sticky top-0 border-b border-border/80">
                  <tr>
                    <th className="px-4 py-2 font-semibold text-[11px] uppercase">Nama / Pola Item</th>
                    <th className="px-4 py-2 font-semibold text-[11px] uppercase text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {itemExclusions.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-4 py-6 text-center text-muted">
                        Belum ada item yang dikecualikan.
                      </td>
                    </tr>
                  )}
                  {itemExclusions.map((x) => (
                    <tr key={x.id} className="hover:bg-surface-hover/70 transition-colors">
                      <td className="px-4 py-2 font-medium text-foreground">{x.pattern}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeItemExclusion(x.id)}
                          className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                        >
                          Sertakan Lagi
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── 8. Poin Default per Item Group ───────────────────── */}
      <div className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden">
        <button type="button" onClick={() => toggleSection("poin-per-group")}
          className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-surface-hover/50 transition-colors">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-sm font-bold uppercase tracking-wider text-foreground">Poin Default per Item Group</span>
            <span className="text-[11px] font-mono text-muted bg-surface-subtle border border-border/60 rounded px-2 py-0.5">{groupRules.length} grup</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            className={`shrink-0 text-muted transition-transform duration-200 ${openSections.has("poin-per-group") ? "rotate-180" : ""}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {openSections.has("poin-per-group") && (
          <div className="px-5 pb-5 pt-4 space-y-4 border-t border-border/60">
            <p className="text-xs text-muted leading-relaxed">
              Poin standar untuk seluruh item dalam satu kelompok (Item Group) jika tidak terdapat aturan item khusus di atas.
            </p>
            <div className="flex flex-wrap items-end gap-3 pt-1">
              <div className="flex-1 min-w-56">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                  Item Group POS
                </label>
                <input
                  type="text"
                  value={groupInput}
                  onChange={(e) => setGroupInput(e.target.value)}
                  placeholder="Contoh: ACC CAMPURAN NEW"
                  className="w-full rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                />
              </div>
              <div className="w-32">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                  Poin / pcs
                </label>
                <input
                  type="number"
                  value={groupPointsInput}
                  min={0}
                  step={1}
                  onChange={(e) => setGroupPointsInput(e.target.value)}
                  className="w-full rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                />
              </div>
              <button
                type="button"
                onClick={addGroupRule}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-accent-foreground px-4 py-1.5 text-xs font-semibold hover:bg-accent-hover transition-all shadow-xs"
              >
                + Tambah Default
              </button>
            </div>
            {groupRuleError && <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">{groupRuleError}</p>}
            <div className="overflow-x-auto rounded-xl border border-border/80 shadow-xs max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-surface-subtle/80 text-muted text-left sticky top-0 border-b border-border/80">
                  <tr>
                    <th className="px-4 py-2 font-semibold text-[11px] uppercase">Item Group POS</th>
                    <th className="px-4 py-2 font-semibold text-[11px] uppercase text-right">Poin / pcs</th>
                    <th className="px-4 py-2 font-semibold text-[11px] uppercase text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 font-mono">
                  {groupRules.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-muted font-sans">
                        Belum ada aturan default group.
                      </td>
                    </tr>
                  )}
                  {groupRules.map((r) => (
                    <tr key={r.id} className="hover:bg-surface-hover/70 transition-colors">
                      <td className="px-4 py-2 font-sans font-medium text-foreground">{r.itemGroup}</td>
                      <td className="px-4 py-2 text-right text-accent font-bold">+{formatNumber(r.points)}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => deleteGroupRule(r.id)}
                          className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline font-sans"
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── 9. Visibilitas Outlet ─────────────────────────────── */}
      <div className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden">
        <button type="button" onClick={() => toggleSection("visibilitas-outlet")}
          className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-surface-hover/50 transition-colors">
          <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
            <span className="text-sm font-bold uppercase tracking-wider text-foreground">Visibilitas Outlet</span>
            <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-0.5">{allOutlets.length - hiddenOutletCount} tampil</span>
            {hiddenOutletCount > 0 && (
              <span className="text-[11px] font-mono text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded px-2 py-0.5">{hiddenOutletCount} disembunyikan</span>
            )}
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            className={`shrink-0 text-muted transition-transform duration-200 ${openSections.has("visibilitas-outlet") ? "rotate-180" : ""}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {openSections.has("visibilitas-outlet") && (
          <div className="px-5 pb-5 pt-4 space-y-4 border-t border-border/60">
            <p className="text-xs text-muted leading-relaxed">
              Pilih cabang outlet yang ingin ditampilkan atau disembunyikan dari tabel matriks performa dan ranking. Outlet yang disembunyikan tidak akan muncul di daftar performa utama.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <input
                type="text"
                value={outletFilter}
                onChange={(e) => setOutletFilter(e.target.value)}
                placeholder="Cari nama outlet..."
                className="w-full max-w-sm rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
              />
            </div>
            <div className="overflow-x-auto rounded-xl border border-border/80 shadow-xs max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-surface-subtle/80 text-muted text-left sticky top-0 border-b border-border/80 z-10">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold text-[11px] uppercase">Nama Outlet</th>
                    <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right">Total Omzet</th>
                    <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right">Status Visibilitas</th>
                    <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right">Aksi Toggle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredOutlets.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-muted">
                        Tidak ada outlet yang cocok dengan pencarian.
                      </td>
                    </tr>
                  )}
                  {filteredOutlets.map((outlet) => {
                    const isBusy = visibilityBusyId === `outlet-${outlet.id}`;
                    return (
                      <tr
                        key={outlet.id}
                        className={`hover:bg-surface-hover/70 transition-colors ${
                          outlet.isHidden ? "bg-surface-subtle/30 opacity-75" : ""
                        }`}
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{outlet.name}</span>
                            {outlet.isHidden && (
                              <span className="text-[10px] font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 px-1.5 py-0.2 rounded border border-rose-500/20">
                                Hidden
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-foreground font-medium">
                          {outlet.subtotal !== undefined ? formatRupiah(outlet.subtotal) : "-"}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              outlet.isHidden
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            }`}
                          >
                            {outlet.isHidden ? "Disembunyikan" : "Aktif Tampil"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => toggleOutletVisibility(outlet)}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-all shadow-2xs ${
                              outlet.isHidden
                                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                : "bg-rose-600 text-white hover:bg-rose-700"
                            }`}
                          >
                            {isBusy
                              ? "Menyimpan..."
                              : outlet.isHidden
                              ? "✓ Tampilkan"
                              : "✕ Sembunyikan"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── 10. Visibilitas Pegawai ───────────────────────────── */}
      <div className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden">
        <button type="button" onClick={() => toggleSection("visibilitas-pegawai")}
          className="w-full flex items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-surface-hover/50 transition-colors">
          <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 shrink-0" />
            <span className="text-sm font-bold uppercase tracking-wider text-foreground">Visibilitas Pegawai</span>
            <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded px-2 py-0.5">{allEmployees.length - hiddenEmployeeCount} tampil</span>
            {hiddenEmployeeCount > 0 && (
              <span className="text-[11px] font-mono text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded px-2 py-0.5">{hiddenEmployeeCount} disembunyikan</span>
            )}
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            className={`shrink-0 text-muted transition-transform duration-200 ${openSections.has("visibilitas-pegawai") ? "rotate-180" : ""}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {openSections.has("visibilitas-pegawai") && (
          <div className="px-5 pb-5 pt-4 space-y-4 border-t border-border/60">
            <p className="text-xs text-muted leading-relaxed">
              Pilih pegawai/karyawan yang ingin ditampilkan atau disembunyikan dari tabel performa sales. Pegawai yang disembunyikan tidak akan tercantum di matriks performa pegawai.
            </p>
            <div className="flex items-center gap-3 pt-1">
              <input
                type="text"
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                placeholder="Cari nama pegawai..."
                className="w-full max-w-sm rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
              />
            </div>
            <div className="overflow-x-auto rounded-xl border border-border/80 shadow-xs max-h-96 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-surface-subtle/80 text-muted text-left sticky top-0 border-b border-border/80 z-10">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold text-[11px] uppercase">Nama Pegawai</th>
                    <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right">Total Omzet</th>
                    <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right">Status Visibilitas</th>
                    <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right">Aksi Toggle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredEmployees.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-muted">
                        Tidak ada pegawai yang cocok dengan pencarian.
                      </td>
                    </tr>
                  )}
                  {filteredEmployees.map((emp) => {
                    const isBusy = visibilityBusyId === `emp-${emp.id}`;
                    return (
                      <tr
                        key={emp.id}
                        className={`hover:bg-surface-hover/70 transition-colors ${
                          emp.isHidden ? "bg-surface-subtle/30 opacity-75" : ""
                        }`}
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{emp.name}</span>
                            {emp.isHidden && (
                              <span className="text-[10px] font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 px-1.5 py-0.2 rounded border border-rose-500/20">
                                Hidden
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-foreground font-medium">
                          {emp.subtotal !== undefined ? formatRupiah(emp.subtotal) : "-"}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              emp.isHidden
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            }`}
                          >
                            {emp.isHidden ? "Disembunyikan" : "Aktif Tampil"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => toggleEmployeeVisibility(emp)}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-all shadow-2xs ${
                              emp.isHidden
                                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                : "bg-rose-600 text-white hover:bg-rose-700"
                            }`}
                          >
                            {isBusy
                              ? "Menyimpan..."
                              : emp.isHidden
                              ? "✓ Tampilkan"
                              : "✕ Sembunyikan"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
