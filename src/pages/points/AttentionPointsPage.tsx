import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDate, formatNumber } from "@/lib/format";
import { usePointsSettings } from "@/hooks/usePointsSettings";

interface AttentionProgram {
  id: number;
  name: string;
  points: number;
  description: string | null;
  isActive: boolean;
  entryCount: number;
}

interface EmployeeOption {
  id: number;
  name: string;
  homeOutletName: string | null;
  homeBranch: "BANDUNG" | "CIMAHI" | null;
  isExcluded: boolean;
}

interface AttentionLeaderboardRow {
  employeeId: number;
  employeeName: string;
  outlet: string | null;
  homeBranch: "BANDUNG" | "CIMAHI" | null;
  totalPoints: number;
  totalQty: number;
  entryCount: number;
}

interface AttentionLeaderboardResponse {
  rows: AttentionLeaderboardRow[];
  unassignedCount: number;
  from: string;
  to: string;
}

interface ProgramBreakdownRow {
  programId: number;
  programName: string;
  qty: number;
  pointsPerUnit: number;
  totalPoints: number;
}

interface AttentionEntry {
  id: number;
  tanggal: string;
  employeeId: number;
  employeeName: string;
  programId: number;
  programName: string;
  programIsActive: boolean;
  qty: number;
  pointsPerUnit: number;
  totalPoints: number;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  homeOutletName: string | null;
  homeBranch: "BANDUNG" | "CIMAHI" | null;
}

interface EntriesResponse {
  entries: AttentionEntry[];
  from: string;
  to: string;
}

interface ExportResponse {
  rows: (AttentionLeaderboardRow & { programs: ProgramBreakdownRow[] })[];
  entries: AttentionEntry[];
  from: string;
  to: string;
}

type Mode = "day" | "month" | "range";
type ViewTab = "leaderboard" | "history";

const MODE_LABEL: Record<Mode, string> = {
  day: "Per Hari",
  month: "Per Bulan",
  range: "Per Rentang",
};

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function currentPeriodMonthStr(periodStartDay: number): string {
  const d = new Date();
  let year = d.getFullYear();
  let month = d.getMonth() + 1;
  if (d.getDate() < periodStartDay) {
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return `${year}-${String(month).padStart(2, "0")}`;
}

function SearchableEmployeeSelect({
  id,
  employees,
  value,
  onChange,
  disabled,
}: {
  id?: string;
  employees: EmployeeOption[];
  value: string;
  onChange: (empId: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => employees.find((e) => String(e.id) === value) ?? null,
    [employees, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.homeOutletName && e.homeOutletName.toLowerCase().includes(q))
    );
  }, [employees, query]);

  useEffect(() => {
    function handleOutside(ev: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(ev.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen((prev) => {
            const next = !prev;
            if (next) setTimeout(() => searchInputRef.current?.focus(), 0);
            return next;
          });
          setQuery("");
        }}
        className="w-full flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-left text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all disabled:opacity-50"
      >
        <span className={selected ? "truncate font-medium" : "truncate text-muted"}>
          {selected
            ? `${selected.name}${selected.homeOutletName ? ` (${selected.homeOutletName})` : ""}`
            : "-- Pilih Pegawai --"}
        </span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0 text-muted">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-40 mt-1 w-full min-w-[240px] rounded-xl border border-border/80 bg-surface shadow-xl overflow-hidden">
          <div className="p-2 border-b border-border/60 bg-surface-subtle/50">
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama pegawai / outlet..."
              className="w-full rounded-lg border border-border/80 bg-surface px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </div>
          <div className="max-h-56 overflow-y-auto divide-y divide-border/40">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-[11px] text-muted">
                Pegawai tidak ditemukan.
              </div>
            ) : (
              filtered.map((emp) => {
                const isSelected = String(emp.id) === value;
                return (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => {
                      onChange(String(emp.id));
                      setOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2 transition-colors ${
                      isSelected ? "bg-accent/10 text-accent font-semibold" : "hover:bg-surface-hover text-foreground"
                    }`}
                  >
                    <span className="truncate">{emp.name}</span>
                    <span className="shrink-0 text-[10px] text-muted">
                      {emp.homeOutletName
                        ? `${emp.homeOutletName}${emp.homeBranch ? ` · ${emp.homeBranch === "CIMAHI" ? "CMH" : "BDG"}` : ""}`
                        : "Belum ada penjualan"}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function AttentionPointsPage({ branch = "BANDUNG" }: { branch?: "BANDUNG" | "CIMAHI" } = {}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const basePath = branch === "CIMAHI" ? "/cimahi/points/atensi" : "/points/atensi";

  const { data: settings } = usePointsSettings(branch);
  const periodStartDay = settings?.periodStartDay ?? 1;

  const urlMode = (searchParams.get("mode") as Mode) || "month";
  const urlDay = searchParams.get("day") || todayStr();
  const urlMonth = searchParams.get("month") || currentPeriodMonthStr(periodStartDay);
  const urlFrom = searchParams.get("from") || todayStr();
  const urlTo = searchParams.get("to") || todayStr();

  const [mode, setMode] = useState<Mode>(urlMode);
  const [day, setDay] = useState(urlDay);
  const [month, setMonth] = useState(urlMonth);
  const [from, setFrom] = useState(urlFrom);
  const [to, setTo] = useState(urlTo);

  useEffect(() => {
    if (searchParams.get("month")) return;
    setMonth(currentPeriodMonthStr(periodStartDay));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodStartDay]);

  const [viewTab, setViewTab] = useState<ViewTab>("leaderboard");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [excelBusy, setExcelBusy] = useState(false);

  // Input form state
  const [entryDate, setEntryDate] = useState(todayStr());
  const [entryEmployeeId, setEntryEmployeeId] = useState("");
  const [entryProgramId, setEntryProgramId] = useState("");
  const [entryQty, setEntryQty] = useState("1");
  const [entryNote, setEntryNote] = useState("");
  const [entryBusy, setEntryBusy] = useState(false);
  const [entryMsg, setEntryMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // History filter
  const [historySearch, setHistorySearch] = useState("");
  const [historyProgramFilter, setHistoryProgramFilter] = useState("");

  // Program management modal
  const [programModalOpen, setProgramModalOpen] = useState(false);
  const [newProgName, setNewProgName] = useState("");
  const [newProgPoints, setNewProgPoints] = useState("10");
  const [newProgDesc, setNewProgDesc] = useState("");
  const [progBusy, setProgBusy] = useState(false);
  const [progMsg, setProgMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [editingProg, setEditingProg] = useState<AttentionProgram | null>(null);
  const [editProgName, setEditProgName] = useState("");
  const [editProgPoints, setEditProgPoints] = useState("");
  const [editProgDesc, setEditProgDesc] = useState("");

  // Edit entry modal
  const [editingEntry, setEditingEntry] = useState<AttentionEntry | null>(null);
  const [editEntryDate, setEditEntryDate] = useState("");
  const [editEntryEmployeeId, setEditEntryEmployeeId] = useState("");
  const [editEntryProgramId, setEditEntryProgramId] = useState("");
  const [editEntryQty, setEditEntryQty] = useState("1");
  const [editEntryNote, setEditEntryNote] = useState("");
  const [editEntryBusy, setEditEntryBusy] = useState(false);
  const [editEntryError, setEditEntryError] = useState<string | null>(null);

  // Delete entry state
  const [deletingEntryId, setDeletingEntryId] = useState<number | null>(null);

  const queryParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set("branch", branch);
    if (urlMode === "day") {
      params.set("from", urlDay);
      params.set("to", urlDay);
    } else if (urlMode === "range") {
      params.set("from", urlFrom);
      params.set("to", urlTo);
    } else {
      const [y, m] = urlMonth.split("-").map(Number);
      params.set("year", String(y));
      params.set("month", String(m));
    }
    return params;
  }, [branch, urlMode, urlDay, urlFrom, urlTo, urlMonth]);

  const periodKey = queryParams().toString();

  const { data: programs = [], isLoading: programsLoading } = useQuery({
    queryKey: ["attention-programs", branch],
    queryFn: async (): Promise<AttentionProgram[]> => {
      const res = await fetch(`/api/points/attention/programs?branch=${branch}`);
      if (!res.ok) throw new Error("Gagal memuat daftar program atensi.");
      return res.json();
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["attention-employees", branch],
    queryFn: async (): Promise<EmployeeOption[]> => {
      const res = await fetch(`/api/points/attention/employees?branch=${branch}`);
      if (!res.ok) throw new Error("Gagal memuat daftar pegawai.");
      return res.json();
    },
  });

  const activePrograms = useMemo(() => programs.filter((p) => p.isActive), [programs]);

  const effectiveProgramId = useMemo(() => {
    if (entryProgramId && activePrograms.some((p) => String(p.id) === entryProgramId)) {
      return entryProgramId;
    }
    return activePrograms[0] ? String(activePrograms[0].id) : "";
  }, [activePrograms, entryProgramId]);

  const { data: leaderboardData, isLoading: leaderboardLoading } = useQuery({
    queryKey: ["attention-leaderboard", periodKey],
    queryFn: async (): Promise<AttentionLeaderboardResponse> => {
      const res = await fetch(`/api/points/attention/leaderboard?${periodKey}`);
      if (!res.ok) throw new Error("Gagal memuat klasemen poin atensi.");
      return res.json();
    },
  });

  const { data: breakdown, isLoading: breakdownLoading } = useQuery({
    queryKey: ["attention-employee-breakdown", expandedId, periodKey],
    queryFn: async (): Promise<ProgramBreakdownRow[]> => {
      const res = await fetch(`/api/points/attention/employee/${expandedId}?${periodKey}`);
      if (!res.ok) throw new Error("Gagal memuat rincian program.");
      return res.json();
    },
    enabled: expandedId !== null,
  });

  const { data: entriesData, isLoading: entriesLoading } = useQuery({
    queryKey: ["attention-entries", periodKey],
    queryFn: async (): Promise<EntriesResponse> => {
      const res = await fetch(`/api/points/attention/entries?${periodKey}`);
      if (!res.ok) throw new Error("Gagal memuat riwayat input.");
      return res.json();
    },
  });

  useEffect(() => {
    setExpandedId(null);
  }, [periodKey]);

  function invalidateAttentionQueries() {
    queryClient.invalidateQueries({ queryKey: ["attention-programs"] });
    queryClient.invalidateQueries({ queryKey: ["attention-leaderboard"] });
    queryClient.invalidateQueries({ queryKey: ["attention-entries"] });
    queryClient.invalidateQueries({ queryKey: ["attention-employee-breakdown"] });
  }

  function applyFilters() {
    const params = new URLSearchParams();
    params.set("mode", mode);
    if (mode === "day") params.set("day", day);
    else if (mode === "range") {
      params.set("from", from);
      params.set("to", to);
    } else params.set("month", month);
    navigate(`${basePath}?${params.toString()}`);
  }

  const selectedProgram = useMemo(
    () => activePrograms.find((p) => String(p.id) === effectiveProgramId) ?? null,
    [activePrograms, effectiveProgramId]
  );

  const parsedQty = Math.max(0, Math.floor(Number(entryQty) || 0));
  const previewPoints = selectedProgram ? parsedQty * selectedProgram.points : 0;

  async function handleSubmitEntry(e: React.FormEvent) {
    e.preventDefault();
    setEntryMsg(null);
    if (!entryEmployeeId) {
      setEntryMsg({ type: "err", text: "Pilih nama pegawai terlebih dahulu." });
      return;
    }
    if (!effectiveProgramId) {
      setEntryMsg({ type: "err", text: "Pilih program atensi yang aktif." });
      return;
    }
    if (parsedQty <= 0) {
      setEntryMsg({ type: "err", text: "Jumlah (qty) minimal 1." });
      return;
    }

    setEntryBusy(true);
    try {
      const res = await fetch(`/api/points/attention/entries?branch=${branch}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tanggal: entryDate,
          employeeId: Number(entryEmployeeId),
          programId: Number(effectiveProgramId),
          qty: parsedQty,
          note: entryNote.trim() || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEntryMsg({ type: "err", text: body.error || "Gagal menyimpan poin atensi." });
        return;
      }
      setEntryMsg({
        type: "ok",
        text: `Berhasil menambahkan +${formatNumber(body.totalPoints)} poin (${body.programName} ${body.qty}x) untuk ${body.employeeName}.`,
      });
      setEntryQty("1");
      setEntryNote("");
      invalidateAttentionQueries();
    } catch {
      setEntryMsg({ type: "err", text: "Terjadi kesalahan jaringan." });
    } finally {
      setEntryBusy(false);
    }
  }

  async function handleCreateProgram(e: React.FormEvent) {
    e.preventDefault();
    setProgMsg(null);
    setProgBusy(true);
    try {
      const res = await fetch(`/api/points/attention/programs?branch=${branch}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProgName,
          points: Number(newProgPoints),
          description: newProgDesc.trim() || null,
          isActive: true,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProgMsg({ type: "err", text: body.error || "Gagal membuat program." });
        return;
      }
      setProgMsg({ type: "ok", text: `Program "${body.name}" (+${body.points} poin) berhasil ditambahkan.` });
      setNewProgName("");
      setNewProgPoints("10");
      setNewProgDesc("");
      invalidateAttentionQueries();
    } catch {
      setProgMsg({ type: "err", text: "Terjadi kesalahan jaringan." });
    } finally {
      setProgBusy(false);
    }
  }

  async function handleToggleProgram(prog: AttentionProgram) {
    setProgMsg(null);
    try {
      const res = await fetch(`/api/points/attention/programs/${prog.id}?branch=${branch}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !prog.isActive }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProgMsg({ type: "err", text: body.error || "Gagal mengubah status program." });
        return;
      }
      invalidateAttentionQueries();
    } catch {
      setProgMsg({ type: "err", text: "Terjadi kesalahan jaringan." });
    }
  }

  async function handleSaveProgramEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingProg) return;
    setProgMsg(null);
    setProgBusy(true);
    try {
      const res = await fetch(`/api/points/attention/programs/${editingProg.id}?branch=${branch}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editProgName,
          points: Number(editProgPoints),
          description: editProgDesc.trim() || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProgMsg({ type: "err", text: body.error || "Gagal memperbarui program." });
        return;
      }
      setEditingProg(null);
      setProgMsg({ type: "ok", text: `Program "${body.name}" berhasil diperbarui.` });
      invalidateAttentionQueries();
    } catch {
      setProgMsg({ type: "err", text: "Terjadi kesalahan jaringan." });
    } finally {
      setProgBusy(false);
    }
  }

  async function handleDeleteProgram(prog: AttentionProgram) {
    setProgMsg(null);
    try {
      const res = await fetch(`/api/points/attention/programs/${prog.id}?branch=${branch}`, {
        method: "DELETE",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProgMsg({ type: "err", text: body.error || "Gagal menghapus program." });
        return;
      }
      invalidateAttentionQueries();
    } catch {
      setProgMsg({ type: "err", text: "Terjadi kesalahan jaringan." });
    }
  }

  function openEditEntry(entry: AttentionEntry) {
    setEditingEntry(entry);
    setEditEntryDate(entry.tanggal.slice(0, 10));
    setEditEntryEmployeeId(String(entry.employeeId));
    setEditEntryProgramId(String(entry.programId));
    setEditEntryQty(String(entry.qty));
    setEditEntryNote(entry.note ?? "");
    setEditEntryError(null);
  }

  async function handleSaveEntryEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEntry) return;
    setEditEntryBusy(true);
    setEditEntryError(null);
    try {
      const res = await fetch(`/api/points/attention/entries/${editingEntry.id}?branch=${branch}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tanggal: editEntryDate,
          employeeId: Number(editEntryEmployeeId),
          programId: Number(editEntryProgramId),
          qty: Number(editEntryQty),
          note: editEntryNote.trim() || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEditEntryError(body.error || "Gagal memperbarui data.");
        return;
      }
      setEditingEntry(null);
      invalidateAttentionQueries();
    } catch {
      setEditEntryError("Terjadi kesalahan jaringan.");
    } finally {
      setEditEntryBusy(false);
    }
  }

  async function handleDeleteEntry(id: number) {
    setDeletingEntryId(id);
    try {
      const res = await fetch(`/api/points/attention/entries/${id}?branch=${branch}`, {
        method: "DELETE",
      });
      if (res.ok) {
        invalidateAttentionQueries();
      }
    } finally {
      setDeletingEntryId(null);
    }
  }

  const filteredEntries = useMemo(() => {
    const list = entriesData?.entries ?? [];
    const q = historySearch.trim().toLowerCase();
    return list.filter((e) => {
      if (historyProgramFilter && String(e.programId) !== historyProgramFilter) return false;
      if (!q) return true;
      return (
        e.employeeName.toLowerCase().includes(q) ||
        e.programName.toLowerCase().includes(q) ||
        (e.note && e.note.toLowerCase().includes(q)) ||
        (e.homeOutletName && e.homeOutletName.toLowerCase().includes(q))
      );
    });
  }, [entriesData, historySearch, historyProgramFilter]);

  async function exportExcel() {
    if (!leaderboardData) return;
    setExcelBusy(true);
    try {
      const [XLSX, exportRes] = await Promise.all([
        import("xlsx"),
        fetch(`/api/points/attention/leaderboard/export?${periodKey}`),
      ]);
      if (!exportRes.ok) throw new Error("gagal memuat data export");
      const exportData: ExportResponse = await exportRes.json();

      const meta: (string | number)[][] = [
        [`Papan Poin Atensi — Cabang ${branch === "CIMAHI" ? "Cimahi" : "Bandung"}`],
        [`Periode: ${formatDate(exportData.from)} - ${formatDate(exportData.to)}`],
        [],
      ];

      const header1 = ["Peringkat", "Nama Pegawai", "Outlet (Penjualan)", "Qty Aktivitas", "Total Poin"];
      const totalPts = exportData.rows.reduce((s, r) => s + r.totalPoints, 0);
      const totalQty = exportData.rows.reduce((s, r) => s + r.totalQty, 0);
      const rows1 = exportData.rows.map((r, idx) => [
        idx + 1,
        r.employeeName,
        r.outlet ?? "-",
        r.totalQty,
        r.totalPoints,
      ]);
      const ws1 = XLSX.utils.aoa_to_sheet([
        ...meta,
        header1,
        ...rows1,
        ["", "TOTAL", "", totalQty, totalPts],
      ]);
      ws1["!cols"] = [{ wch: 10 }, { wch: 28 }, { wch: 20 }, { wch: 14 }, { wch: 12 }];

      const header2 = ["Peringkat", "Nama Pegawai", "Program Atensi", "Qty", "Poin / Aktivitas", "Subtotal Poin"];
      const rows2: (string | number)[][] = [];
      exportData.rows.forEach((r, idx) => {
        for (const p of r.programs) {
          rows2.push([idx + 1, r.employeeName, p.programName, p.qty, p.pointsPerUnit, p.totalPoints]);
        }
      });
      const ws2 = XLSX.utils.aoa_to_sheet([...meta, header2, ...rows2]);
      ws2["!cols"] = [{ wch: 10 }, { wch: 26 }, { wch: 28 }, { wch: 8 }, { wch: 16 }, { wch: 14 }];

      const header3 = ["Tanggal", "Nama Pegawai", "Outlet", "Program Atensi", "Qty", "Poin / Aktivitas", "Total Poin", "Catatan", "Diinput Oleh"];
      const rows3 = exportData.entries.map((e) => [
        e.tanggal.slice(0, 10),
        e.employeeName,
        e.homeOutletName ?? "-",
        e.programName,
        e.qty,
        e.pointsPerUnit,
        e.totalPoints,
        e.note ?? "",
        e.createdBy ?? "",
      ]);
      const ws3 = XLSX.utils.aoa_to_sheet([...meta, header3, ...rows3]);
      ws3["!cols"] = [
        { wch: 12 }, { wch: 24 }, { wch: 18 }, { wch: 24 },
        { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 28 }, { wch: 16 },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws1, "Klasemen Atensi");
      XLSX.utils.book_append_sheet(wb, ws2, "Rincian Program");
      XLSX.utils.book_append_sheet(wb, ws3, "Riwayat Input");
      XLSX.writeFile(
        wb,
        `poin-atensi-${branch.toLowerCase()}-${exportData.from.slice(0, 10)}_sd_${exportData.to.slice(0, 10)}.xlsx`
      );
    } catch {
      // ignore
    } finally {
      setExcelBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Control & Filter Card */}
      <div className="rounded-xl border border-border/80 bg-surface p-4 space-y-3.5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-lg border border-border/80 p-1 bg-surface-subtle shadow-2xs">
            {(["day", "month", "range"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  mode === m
                    ? "bg-surface text-foreground shadow-xs border border-border/60"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setProgMsg(null);
                setEditingProg(null);
                setProgramModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 hover:bg-accent/20 px-3 py-1.5 text-xs font-semibold text-accent transition-all shadow-2xs"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span>Kelola Program ({activePrograms.length} Aktif)</span>
            </button>
            <button
              type="button"
              onClick={exportExcel}
              disabled={!leaderboardData || (leaderboardData.rows.length === 0 && (entriesData?.entries.length ?? 0) === 0) || excelBusy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/80 bg-surface-subtle hover:bg-surface-hover px-3 py-1.5 text-xs font-medium text-foreground transition-all disabled:opacity-50 shadow-2xs"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              <span>{excelBusy ? "Memproses..." : "Export Excel"}</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3 pt-1">
          {mode === "day" && (
            <div>
              <label htmlFor="atensi-day" className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                Pilih Tanggal
              </label>
              <input
                id="atensi-day"
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
              />
            </div>
          )}
          {mode === "month" && (
            <div>
              <label htmlFor="atensi-month" className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                Pilih Bulan
              </label>
              <input
                id="atensi-month"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
              />
            </div>
          )}
          {mode === "range" && (
            <>
              <div>
                <label htmlFor="atensi-from" className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                  Dari Tanggal
                </label>
                <input
                  id="atensi-from"
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                />
              </div>
              <div>
                <label htmlFor="atensi-to" className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                  Sampai Tanggal
                </label>
                <input
                  id="atensi-to"
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                />
              </div>
            </>
          )}
          <button
            type="button"
            onClick={applyFilters}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-accent-foreground px-4 py-1.5 text-xs font-semibold hover:bg-accent-hover transition-all shadow-xs"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Tampilkan</span>
          </button>
          {leaderboardData && (
            <span className="text-xs text-muted font-medium ml-1">
              Periode: <strong className="text-foreground">{formatDate(leaderboardData.from)}</strong> –{" "}
              <strong className="text-foreground">{formatDate(leaderboardData.to)}</strong>
            </span>
          )}
        </div>
      </div>

      {/* Input Poin Atensi Form Card */}
      <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-foreground">Input Poin Atensi</h2>
            <p className="text-[11px] text-muted">
              Pilih pegawai, program atensi aktif, dan jumlah kali pelaksanaan program (tanpa nomor transaksi POS).
            </p>
          </div>
          {selectedProgram && parsedQty > 0 && (
            <div className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 px-3 py-1 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
              <span>{parsedQty} × {selectedProgram.points}</span>
              <span>=</span>
              <span>+{formatNumber(previewPoints)} poin</span>
            </div>
          )}
        </div>

        {!programsLoading && activePrograms.length === 0 ? (
          <div className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-amber-700 dark:text-amber-300">
              Belum ada program poin atensi yang aktif. Tambahkan program (misal: Google Review — 10 poin) terlebih dahulu.
            </span>
            <button
              type="button"
              onClick={() => setProgramModalOpen(true)}
              className="rounded-lg bg-accent text-accent-foreground px-3 py-1.5 text-xs font-semibold hover:bg-accent-hover transition-all"
            >
              + Buat Program Atensi
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmitEntry} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
            <div className="lg:col-span-2">
              <label htmlFor="atensi-entry-date" className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                Tanggal
              </label>
              <input
                id="atensi-entry-date"
                type="date"
                required
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              />
            </div>

            <div className="lg:col-span-3">
              <label htmlFor="atensi-entry-employee" className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                Nama Pegawai
              </label>
              <SearchableEmployeeSelect
                id="atensi-entry-employee"
                employees={employees}
                value={entryEmployeeId}
                onChange={setEntryEmployeeId}
                disabled={entryBusy}
              />
            </div>

            <div className="lg:col-span-3">
              <label htmlFor="atensi-entry-program" className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                Program Atensi
              </label>
              <select
                id="atensi-entry-program"
                value={effectiveProgramId}
                onChange={(e) => setEntryProgramId(e.target.value)}
                className="w-full rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              >
                {activePrograms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (+{p.points} poin)
                  </option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-1">
              <label htmlFor="atensi-entry-qty" className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                Qty
              </label>
              <input
                id="atensi-entry-qty"
                type="number"
                min={1}
                step={1}
                required
                value={entryQty}
                onChange={(e) => setEntryQty(e.target.value)}
                className="w-full rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              />
            </div>

            <div className="lg:col-span-2">
              <label htmlFor="atensi-entry-note" className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
                Catatan (Opsional)
              </label>
              <input
                id="atensi-entry-note"
                type="text"
                value={entryNote}
                onChange={(e) => setEntryNote(e.target.value)}
                placeholder="Ket. / nama customer"
                className="w-full rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
              />
            </div>

            <div className="lg:col-span-1">
              <button
                type="submit"
                disabled={entryBusy || activePrograms.length === 0}
                className="w-full rounded-lg bg-accent text-accent-foreground px-3 py-1.5 text-xs font-semibold hover:bg-accent-hover transition-all disabled:opacity-50 shadow-xs"
              >
                {entryBusy ? "..." : "Simpan"}
              </button>
            </div>
          </form>
        )}

        {entryMsg && (
          <div
            className={`rounded-lg px-3 py-2 text-xs font-medium border ${
              entryMsg.type === "ok"
                ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300"
                : "bg-rose-500/10 border-rose-500/25 text-rose-600 dark:text-rose-400"
            }`}
          >
            {entryMsg.text}
          </div>
        )}
      </div>

      {/* View Switcher */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="inline-flex rounded-xl border border-border/80 p-1 bg-surface-subtle shadow-2xs">
          <button
            type="button"
            onClick={() => setViewTab("leaderboard")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewTab === "leaderboard"
                ? "bg-surface text-foreground shadow-xs border border-border/60"
                : "text-muted hover:text-foreground"
            }`}
          >
            Klasemen ({leaderboardData?.rows.length ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setViewTab("history")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewTab === "history"
                ? "bg-surface text-foreground shadow-xs border border-border/60"
                : "text-muted hover:text-foreground"
            }`}
          >
            Riwayat Input ({entriesData?.entries.length ?? 0})
          </button>
        </div>
      </div>

      {viewTab === "leaderboard" ? (
        <>
          {leaderboardData && leaderboardData.unassignedCount > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-300 flex items-center justify-between gap-2">
              <span>
                Terdapat <strong>{leaderboardData.unassignedCount}</strong> input poin atensi untuk pegawai yang belum memiliki data penjualan di sistem sehingga belum terpetakan ke cabang. Cek di tab <strong>Riwayat Input</strong>.
              </span>
            </div>
          )}

          {leaderboardLoading || !leaderboardData ? (
            <div className="flex items-center justify-center p-12 text-xs text-muted font-medium">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent animate-ping" />
                <span>Memuat klasemen poin atensi...</span>
              </div>
            </div>
          ) : leaderboardData.rows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/80 bg-surface/50 p-10 text-center text-xs text-muted font-medium">
              Belum ada poin atensi untuk cabang {branch === "CIMAHI" ? "Cimahi" : "Bandung"} pada periode yang dipilih.
            </div>
          ) : (
            <div className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-surface-subtle/70 text-muted text-left border-b border-border/80">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold text-[11px] uppercase w-12">#</th>
                    <th className="px-4 py-2.5 font-semibold text-[11px] uppercase">Nama Pegawai</th>
                    <th className="px-4 py-2.5 font-semibold text-[11px] uppercase">Outlet (Penjualan)</th>
                    <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right">Qty Program</th>
                    <th className="px-4 py-2.5 font-semibold text-[11px] uppercase text-right">Total Poin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {leaderboardData.rows.map((r, idx) => {
                    const rank = idx + 1;
                    const isExpanded = expandedId === r.employeeId;
                    return (
                      <Fragment key={r.employeeId}>
                        <tr
                          onClick={() => setExpandedId((cur) => (cur === r.employeeId ? null : r.employeeId))}
                          className={`cursor-pointer transition-colors ${
                            isExpanded ? "bg-accent/5" : "hover:bg-surface-hover/70"
                          }`}
                        >
                          <td className="px-4 py-3 text-muted tabular-nums">
                            <span
                              className={`w-5 h-5 rounded-md grid place-items-center text-[10px] font-bold font-mono ${
                                rank === 1
                                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                  : rank === 2
                                  ? "bg-slate-500/15 text-slate-600 dark:text-slate-300 border border-slate-500/30"
                                  : rank === 3
                                  ? "bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30"
                                  : "bg-surface-subtle text-muted"
                              }`}
                            >
                              {rank}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-foreground">
                            <div className="flex items-center gap-2">
                              <span>{r.employeeName}</span>
                              <span className="text-[10px] text-muted font-normal">
                                {isExpanded ? "▲ tutup" : "▼ rincian"}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted">{r.outlet ?? "—"}</td>
                          <td className="px-4 py-3 text-right font-mono text-foreground font-medium">
                            {formatNumber(r.totalQty)}x
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-sm font-bold text-accent">
                            {formatNumber(r.totalPoints)}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={5} className="px-6 py-4 bg-surface-subtle/50 border-y border-border/60">
                              {breakdownLoading ? (
                                <div className="text-xs text-muted font-medium py-2">Memuat rincian program...</div>
                              ) : breakdown && breakdown.length > 0 ? (
                                <div className="overflow-x-auto rounded-lg border border-border/80 bg-surface shadow-2xs">
                                  <table className="w-full text-xs">
                                    <thead className="bg-surface-subtle/60 text-muted text-left border-b border-border/70">
                                      <tr>
                                        <th className="px-3 py-2 font-semibold text-[11px] uppercase">Program Atensi</th>
                                        <th className="px-3 py-2 font-semibold text-[11px] uppercase text-right">Qty</th>
                                        <th className="px-3 py-2 font-semibold text-[11px] uppercase text-right">Poin / Aktivitas</th>
                                        <th className="px-3 py-2 font-semibold text-[11px] uppercase text-right">Subtotal Poin</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/40 font-mono">
                                      {breakdown.map((b) => (
                                        <tr key={`${b.programId}-${b.pointsPerUnit}`} className="hover:bg-surface-hover/50">
                                          <td className="px-3 py-2 font-sans font-medium text-foreground">{b.programName}</td>
                                          <td className="px-3 py-2 text-right text-foreground">{formatNumber(b.qty)}x</td>
                                          <td className="px-3 py-2 text-right text-muted">+{b.pointsPerUnit}</td>
                                          <td className="px-3 py-2 text-right font-bold text-accent">{formatNumber(b.totalPoints)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div className="text-xs text-muted py-2">Tidak ada rincian program untuk periode ini.</div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border border-border/80 bg-surface p-3 flex flex-wrap items-center gap-3 shadow-xs">
            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Cari pegawai, program, outlet, atau catatan..."
              className="flex-1 min-w-[200px] rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
            <select
              value={historyProgramFilter}
              onChange={(e) => setHistoryProgramFilter(e.target.value)}
              className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            >
              <option value="">Semua Program</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {!p.isActive ? "(Nonaktif)" : ""}
                </option>
              ))}
            </select>
          </div>

          {entriesLoading ? (
            <div className="p-10 text-center text-xs text-muted">Memuat riwayat input...</div>
          ) : filteredEntries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/80 bg-surface/50 p-10 text-center text-xs text-muted">
              Belum ada riwayat input poin atensi pada periode ini.
            </div>
          ) : (
            <div className="rounded-xl border border-border/80 bg-surface shadow-xs overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-surface-subtle/70 text-muted text-left border-b border-border/80">
                  <tr>
                    <th className="px-3.5 py-2.5 font-semibold text-[11px] uppercase">Tanggal</th>
                    <th className="px-3.5 py-2.5 font-semibold text-[11px] uppercase">Pegawai</th>
                    <th className="px-3.5 py-2.5 font-semibold text-[11px] uppercase">Outlet (Penjualan)</th>
                    <th className="px-3.5 py-2.5 font-semibold text-[11px] uppercase">Program</th>
                    <th className="px-3.5 py-2.5 font-semibold text-[11px] uppercase text-right">Qty</th>
                    <th className="px-3.5 py-2.5 font-semibold text-[11px] uppercase text-right">Total Poin</th>
                    <th className="px-3.5 py-2.5 font-semibold text-[11px] uppercase">Catatan</th>
                    <th className="px-3.5 py-2.5 font-semibold text-[11px] uppercase">Oleh</th>
                    <th className="px-3.5 py-2.5 font-semibold text-[11px] uppercase text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-surface-hover/50 transition-colors">
                      <td className="px-3.5 py-2.5 font-mono text-muted whitespace-nowrap">
                        {formatDate(entry.tanggal)}
                      </td>
                      <td className="px-3.5 py-2.5 font-semibold text-foreground whitespace-nowrap">
                        {entry.employeeName}
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        {entry.homeOutletName ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-foreground">
                            <span>{entry.homeOutletName}</span>
                            <span className="text-[10px] font-mono text-muted">
                              ({entry.homeBranch === "CIMAHI" ? "CMH" : "BDG"})
                            </span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5">
                            Belum ada penjualan
                          </span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span className="font-medium text-foreground">{entry.programName}</span>
                        {!entry.programIsActive && (
                          <span className="ml-1.5 text-[10px] text-muted bg-surface-subtle border border-border/60 rounded px-1 py-0.5">
                            Nonaktif
                          </span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-foreground">
                        {formatNumber(entry.qty)} × {entry.pointsPerUnit}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-bold text-accent">
                        +{formatNumber(entry.totalPoints)}
                      </td>
                      <td className="px-3.5 py-2.5 text-muted max-w-[200px] truncate" title={entry.note ?? ""}>
                        {entry.note || "—"}
                      </td>
                      <td className="px-3.5 py-2.5 text-muted text-[11px]">{entry.createdBy || "—"}</td>
                      <td className="px-3.5 py-2.5 text-right whitespace-nowrap space-x-1.5">
                        <button
                          type="button"
                          onClick={() => openEditEntry(entry)}
                          className="rounded-md border border-border/80 bg-surface-subtle hover:bg-surface-hover px-2 py-1 text-[11px] font-medium text-foreground transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={deletingEntryId === entry.id}
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="rounded-md border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 transition-colors disabled:opacity-50"
                        >
                          {deletingEntryId === entry.id ? "..." : "Hapus"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Kelola Program Atensi */}
      {programModalOpen && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setProgramModalOpen(false);
          }}
        >
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border border-border/80 bg-surface shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border/70 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">Kelola Program Poin Atensi</h3>
                <p className="text-[11px] text-muted">
                  Tambah atau nonaktifkan program (misal: Google Review = 10 poin). Program nonaktif tidak muncul di form input baru, tetapi histori poin lama tetap aman.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProgramModalOpen(false)}
                className="rounded-lg p-1.5 text-muted hover:text-foreground hover:bg-surface-hover transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <form onSubmit={handleCreateProgram} className="rounded-xl border border-border/80 bg-surface-subtle/50 p-3.5 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                <div className="sm:col-span-5">
                  <label htmlFor="atensi-new-prog-name" className="block text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Nama Program
                  </label>
                  <input
                    id="atensi-new-prog-name"
                    type="text"
                    required
                    value={newProgName}
                    onChange={(e) => setNewProgName(e.target.value)}
                    placeholder="Contoh: Google Review"
                    className="w-full rounded-lg border border-border/80 bg-surface px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="atensi-new-prog-points" className="block text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Poin
                  </label>
                  <input
                    id="atensi-new-prog-points"
                    type="number"
                    min={1}
                    step={1}
                    required
                    value={newProgPoints}
                    onChange={(e) => setNewProgPoints(e.target.value)}
                    className="w-full rounded-lg border border-border/80 bg-surface px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label htmlFor="atensi-new-prog-desc" className="block text-[10px] font-semibold uppercase tracking-wider text-muted mb-1">
                    Keterangan (Opsional)
                  </label>
                  <input
                    id="atensi-new-prog-desc"
                    type="text"
                    value={newProgDesc}
                    onChange={(e) => setNewProgDesc(e.target.value)}
                    placeholder="Ket. singkat"
                    className="w-full rounded-lg border border-border/80 bg-surface px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={progBusy}
                    className="w-full rounded-lg bg-accent text-accent-foreground px-3 py-1.5 text-xs font-semibold hover:bg-accent-hover transition-all disabled:opacity-50"
                  >
                    + Tambah
                  </button>
                </div>
              </form>

              {progMsg && (
                <div
                  className={`rounded-lg px-3 py-2 text-xs font-medium border ${
                    progMsg.type === "ok"
                      ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300"
                      : "bg-rose-500/10 border-rose-500/25 text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {progMsg.text}
                </div>
              )}

              {editingProg && (
                <form onSubmit={handleSaveProgramEdit} className="rounded-xl border border-accent/40 bg-accent/5 p-3.5 space-y-2.5">
                  <div className="text-xs font-bold text-foreground">Edit Program: {editingProg.name}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                    <div className="sm:col-span-5">
                      <label htmlFor="atensi-edit-prog-name" className="block text-[10px] font-semibold uppercase text-muted mb-1">Nama</label>
                      <input
                        id="atensi-edit-prog-name"
                        type="text"
                        required
                        value={editProgName}
                        onChange={(e) => setEditProgName(e.target.value)}
                        className="w-full rounded-lg border border-border/80 bg-surface px-2.5 py-1.5 text-xs text-foreground"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label htmlFor="atensi-edit-prog-points" className="block text-[10px] font-semibold uppercase text-muted mb-1">Poin</label>
                      <input
                        id="atensi-edit-prog-points"
                        type="number"
                        min={1}
                        step={1}
                        required
                        value={editProgPoints}
                        onChange={(e) => setEditProgPoints(e.target.value)}
                        className="w-full rounded-lg border border-border/80 bg-surface px-2.5 py-1.5 text-xs font-mono text-foreground"
                      />
                    </div>
                    <div className="sm:col-span-5">
                      <label htmlFor="atensi-edit-prog-desc" className="block text-[10px] font-semibold uppercase text-muted mb-1">Keterangan</label>
                      <input
                        id="atensi-edit-prog-desc"
                        type="text"
                        value={editProgDesc}
                        onChange={(e) => setEditProgDesc(e.target.value)}
                        className="w-full rounded-lg border border-border/80 bg-surface px-2.5 py-1.5 text-xs text-foreground"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingProg(null)}
                      className="rounded-lg border border-border/80 bg-surface px-3 py-1 text-xs font-medium text-foreground"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={progBusy}
                      className="rounded-lg bg-accent text-accent-foreground px-3 py-1 text-xs font-semibold"
                    >
                      Simpan Perubahan
                    </button>
                  </div>
                </form>
              )}

              <div className="rounded-xl border border-border/80 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-surface-subtle/70 text-muted text-left border-b border-border/70">
                    <tr>
                      <th className="px-3.5 py-2 font-semibold text-[11px] uppercase">Program</th>
                      <th className="px-3.5 py-2 font-semibold text-[11px] uppercase text-right">Poin</th>
                      <th className="px-3.5 py-2 font-semibold text-[11px] uppercase text-center">Status</th>
                      <th className="px-3.5 py-2 font-semibold text-[11px] uppercase text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {programs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-muted">
                          Belum ada program atensi. Tambahkan program pertama di atas.
                        </td>
                      </tr>
                    ) : (
                      programs.map((prog) => (
                        <tr key={prog.id} className="hover:bg-surface-hover/40">
                          <td className="px-3.5 py-2.5">
                            <div className="font-semibold text-foreground">{prog.name}</div>
                            {prog.description && (
                              <div className="text-[11px] text-muted">{prog.description}</div>
                            )}
                            <div className="text-[10px] text-muted/80 mt-0.5">{prog.entryCount} riwayat input</div>
                          </td>
                          <td className="px-3.5 py-2.5 text-right font-mono font-bold text-accent">
                            +{prog.points}
                          </td>
                          <td className="px-3.5 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleProgram(prog)}
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold border transition-all ${
                                prog.isActive
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                                  : "bg-surface-subtle text-muted border-border/80 hover:text-foreground"
                              }`}
                              title="Klik untuk ubah status Aktif / Tidak Aktif"
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${prog.isActive ? "bg-emerald-500" : "bg-muted"}`} />
                              {prog.isActive ? "Aktif" : "Tidak Aktif"}
                            </button>
                          </td>
                          <td className="px-3.5 py-2.5 text-right whitespace-nowrap space-x-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingProg(prog);
                                setEditProgName(prog.name);
                                setEditProgPoints(String(prog.points));
                                setEditProgDesc(prog.description ?? "");
                              }}
                              className="rounded-md border border-border/80 bg-surface-subtle hover:bg-surface-hover px-2 py-1 text-[11px] font-medium text-foreground"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={prog.entryCount > 0}
                              title={
                                prog.entryCount > 0
                                  ? "Tidak dapat dihapus karena sudah memiliki riwayat poin. Gunakan toggle Tidak Aktif."
                                  : "Hapus program"
                              }
                              onClick={() => handleDeleteProgram(prog)}
                              className="rounded-md border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 disabled:opacity-35 disabled:cursor-not-allowed"
                            >
                              Hapus
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Entry */}
      {editingEntry && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setEditingEntry(null);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-border/80 bg-surface p-5 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-foreground">Edit Input Poin Atensi</h3>
            <form onSubmit={handleSaveEntryEdit} className="space-y-3">
              <div>
                <label htmlFor="atensi-edit-entry-date" className="block text-[11px] font-semibold uppercase text-muted mb-1">Tanggal</label>
                <input
                  id="atensi-edit-entry-date"
                  type="date"
                  required
                  value={editEntryDate}
                  onChange={(e) => setEditEntryDate(e.target.value)}
                  className="w-full rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground"
                />
              </div>
              <div>
                <label htmlFor="atensi-edit-entry-employee" className="block text-[11px] font-semibold uppercase text-muted mb-1">Nama Pegawai</label>
                <SearchableEmployeeSelect
                  id="atensi-edit-entry-employee"
                  employees={employees}
                  value={editEntryEmployeeId}
                  onChange={setEditEntryEmployeeId}
                  disabled={editEntryBusy}
                />
              </div>
              <div>
                <label htmlFor="atensi-edit-entry-program" className="block text-[11px] font-semibold uppercase text-muted mb-1">Program Atensi</label>
                <select
                  id="atensi-edit-entry-program"
                  value={editEntryProgramId}
                  onChange={(e) => setEditEntryProgramId(e.target.value)}
                  className="w-full rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground"
                >
                  {programs
                    .filter((p) => p.isActive || String(p.id) === editEntryProgramId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (+{p.points} poin){!p.isActive ? " [Nonaktif]" : ""}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label htmlFor="atensi-edit-entry-qty" className="block text-[11px] font-semibold uppercase text-muted mb-1">Qty</label>
                <input
                  id="atensi-edit-entry-qty"
                  type="number"
                  min={1}
                  step={1}
                  required
                  value={editEntryQty}
                  onChange={(e) => setEditEntryQty(e.target.value)}
                  className="w-full rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs font-mono text-foreground"
                />
              </div>
              <div>
                <label htmlFor="atensi-edit-entry-note" className="block text-[11px] font-semibold uppercase text-muted mb-1">Catatan</label>
                <input
                  id="atensi-edit-entry-note"
                  type="text"
                  value={editEntryNote}
                  onChange={(e) => setEditEntryNote(e.target.value)}
                  className="w-full rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground"
                />
              </div>
              {editEntryError && (
                <div className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
                  {editEntryError}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setEditingEntry(null)}
                  className="rounded-lg border border-border/80 bg-surface px-4 py-1.5 text-xs font-semibold text-foreground"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={editEntryBusy}
                  className="rounded-lg bg-accent text-accent-foreground px-4 py-1.5 text-xs font-semibold disabled:opacity-50"
                >
                  {editEntryBusy ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
