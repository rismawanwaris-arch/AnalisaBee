"use client";

import { useCallback, useEffect, useState } from "react";
import { formatNumber } from "@/lib/format";

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
interface EmployeeOption {
  id: number;
  name: string;
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

export function PointsSettingsClient() {
  const [itemRules, setItemRules] = useState<ItemPointRule[]>([]);
  const [patternInput, setPatternInput] = useState("");
  const [pointsInput, setPointsInput] = useState("10");
  const [itemError, setItemError] = useState<string | null>(null);

  const [groupRules, setGroupRules] = useState<GroupPointRule[]>([]);
  const [groupInput, setGroupInput] = useState("");
  const [groupPointsInput, setGroupPointsInput] = useState("5");
  const [groupError, setGroupError] = useState<string | null>(null);

  const [periodStartDay, setPeriodStartDay] = useState("1");
  const [periodBusy, setPeriodBusy] = useState(false);
  const [periodSaved, setPeriodSaved] = useState(false);

  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [excluded, setExcluded] = useState<ExcludedEmployee[]>([]);
  const [excludeEmployeeId, setExcludeEmployeeId] = useState("");
  const [excludeReason, setExcludeReason] = useState("");
  const [excludeError, setExcludeError] = useState<string | null>(null);

  const [itemExclusions, setItemExclusions] = useState<ItemExclusion[]>([]);
  const [itemExclusionInput, setItemExclusionInput] = useState("");
  const [itemExclusionError, setItemExclusionError] = useState<string | null>(null);

  const loadItemRules = useCallback(async () => {
    const res = await fetch("/api/points/items");
    if (res.ok) setItemRules(await res.json());
  }, []);

  const loadGroupRules = useCallback(async () => {
    const res = await fetch("/api/points/group-defaults");
    if (res.ok) setGroupRules(await res.json());
  }, []);

  const loadPeriodSetting = useCallback(async () => {
    const res = await fetch("/api/points/settings");
    if (res.ok) {
      const d = await res.json();
      setPeriodStartDay(String(d.periodStartDay));
    }
  }, []);

  const loadExcluded = useCallback(async () => {
    const res = await fetch("/api/points/excluded-employees");
    if (res.ok) setExcluded(await res.json());
  }, []);

  const loadItemExclusions = useCallback(async () => {
    const res = await fetch("/api/points/item-exclusions");
    if (res.ok) setItemExclusions(await res.json());
  }, []);

  useEffect(() => {
    loadItemRules();
    loadGroupRules();
    loadPeriodSetting();
    loadExcluded();
    loadItemExclusions();
    fetch("/api/employees")
      .then((r) => r.json())
      .then((list: EmployeeOption[]) =>
        setEmployees([...list].sort((a, b) => a.name.localeCompare(b.name)))
      );
  }, [loadItemRules, loadGroupRules, loadPeriodSetting, loadExcluded, loadItemExclusions]);

  async function addItemExclusion() {
    setItemExclusionError(null);
    const pattern = itemExclusionInput.trim();
    if (!pattern) {
      setItemExclusionError("Isi nama/pola item terlebih dahulu.");
      return;
    }
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
  }

  async function removeItemExclusion(id: number) {
    await fetch(`/api/points/item-exclusions/${id}`, { method: "DELETE" });
    await loadItemExclusions();
  }

  async function addExclusion() {
    setExcludeError(null);
    if (!excludeEmployeeId) {
      setExcludeError("Pilih pegawai terlebih dahulu.");
      return;
    }
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
  }

  async function removeExclusion(id: number) {
    await fetch(`/api/points/excluded-employees/${id}`, { method: "DELETE" });
    await loadExcluded();
  }

  const excludableEmployees = employees.filter(
    (e) => !excluded.some((x) => x.employeeId === e.id)
  );

  async function savePeriodSetting() {
    const day = Number(periodStartDay);
    setPeriodBusy(true);
    setPeriodSaved(false);
    const res = await fetch("/api/points/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ periodStartDay: day }),
    });
    setPeriodBusy(false);
    if (res.ok) {
      setPeriodSaved(true);
      setTimeout(() => setPeriodSaved(false), 2500);
    }
  }

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
  }

  async function deleteItemRule(id: number) {
    await fetch(`/api/points/items/${id}`, { method: "DELETE" });
    await loadItemRules();
  }

  async function addGroupRule() {
    setGroupError(null);
    const itemGroup = groupInput.trim();
    const points = Number(groupPointsInput);
    if (!itemGroup) {
      setGroupError("Isi nama Item Group terlebih dahulu.");
      return;
    }
    if (!Number.isInteger(points) || points < 0) {
      setGroupError("Poin harus angka bulat, 0 atau lebih.");
      return;
    }
    const res = await fetch("/api/points/group-defaults", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemGroup, points }),
    });
    const data = await res.json();
    if (!res.ok) {
      setGroupError(data.error ?? "Gagal menyimpan.");
      return;
    }
    setGroupInput("");
    setGroupPointsInput("5");
    await loadGroupRules();
  }

  async function deleteGroupRule(id: number) {
    await fetch(`/api/points/group-defaults/${id}`, { method: "DELETE" });
    await loadGroupRules();
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-base font-semibold text-foreground mb-1">Periode &quot;Per Bulan&quot;</h2>
        <p className="text-sm text-muted mb-4">
          Tentukan tanggal mulai siklus bulanan untuk leaderboard poin. Isi <strong>1</strong> untuk
          bulan kalender biasa, atau mis. <strong>29</strong> kalau periode Anda berjalan tanggal 29
          sampai 28 bulan berikutnya.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-muted mb-1">Tanggal Mulai Periode</label>
            <input
              type="number"
              min={1}
              max={31}
              value={periodStartDay}
              onChange={(e) => setPeriodStartDay(e.target.value)}
              className="w-24 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={savePeriodSetting}
            disabled={periodBusy}
            className="rounded-md bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {periodBusy ? "Menyimpan..." : "Simpan"}
          </button>
          {periodSaved && <span className="text-sm text-positive">Tersimpan.</span>}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-base font-semibold text-foreground mb-1">
          Pegawai Dikecualikan dari Poin
        </h2>
        <p className="text-sm text-muted mb-4">
          Akun staff/admin/gudang yang tidak seharusnya ikut dapat poin — sekali dikecualikan,
          semua penjualan atas nama mereka tidak dihitung di leaderboard periode manapun.
        </p>

        <div className="flex flex-wrap items-end gap-2 mb-4">
          <div className="flex-1 min-w-48">
            <label className="block text-xs text-muted mb-1">Pegawai</label>
            <select
              value={excludeEmployeeId}
              onChange={(e) => setExcludeEmployeeId(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              <option value="">-- Pilih pegawai --</option>
              {excludableEmployees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-48">
            <label className="block text-xs text-muted mb-1">Alasan (opsional)</label>
            <input
              type="text"
              value={excludeReason}
              onChange={(e) => setExcludeReason(e.target.value)}
              placeholder="Contoh: Admin Gudang"
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={addExclusion}
            className="rounded-md bg-accent text-accent-foreground px-3 py-1.5 text-sm font-medium hover:opacity-90"
          >
            + Kecualikan
          </button>
        </div>
        {excludeError && <p className="text-sm text-negative mb-3">{excludeError}</p>}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-background text-muted text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Pegawai</th>
                <th className="px-3 py-2 font-medium">Alasan</th>
                <th className="px-3 py-2 font-medium w-20">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {excluded.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-muted">
                    Belum ada pegawai yang dikecualikan.
                  </td>
                </tr>
              )}
              {excluded.map((x) => (
                <tr key={x.id}>
                  <td className="px-3 py-2 font-medium">{x.employeeName}</td>
                  <td className="px-3 py-2 text-muted">{x.reason || "-"}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => removeExclusion(x.id)}
                      className="text-negative hover:underline"
                    >
                      Sertakan Lagi
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-base font-semibold text-foreground mb-1">Daftar Poin per Item</h2>
        <p className="text-sm text-muted mb-4">
          Nama/pola dicocokkan ke nama item POS tanpa peduli huruf besar-kecil, dan otomatis
          mencakup semua varian warna (contoh: pola <code>&quot;TWS Robot Airbuds T70E&quot;</code>{" "}
          mencakup varian putih, pink, hijau, dst). Kalau ada beberapa pola yang cocok untuk satu
          item, pola yang paling spesifik (paling panjang) yang dipakai.
        </p>

        <div className="flex flex-wrap items-end gap-2 mb-4">
          <div className="flex-1 min-w-56">
            <label className="block text-xs text-muted mb-1">Nama / Pola Item</label>
            <input
              type="text"
              value={patternInput}
              onChange={(e) => setPatternInput(e.target.value)}
              placeholder="Contoh: TWS Robot Airbuds T70E"
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <div className="w-28">
            <label className="block text-xs text-muted mb-1">Poin / pcs</label>
            <input
              type="number"
              value={pointsInput}
              min={0}
              step={1}
              onChange={(e) => setPointsInput(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={addItemRule}
            className="rounded-md bg-accent text-accent-foreground px-3 py-1.5 text-sm font-medium hover:opacity-90"
          >
            + Tambah
          </button>
        </div>
        {itemError && <p className="text-sm text-negative mb-3">{itemError}</p>}

        <div className="overflow-x-auto rounded-lg border border-border max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-background text-muted text-left sticky top-0">
              <tr>
                <th className="px-3 py-2 font-medium">Nama / Pola Item</th>
                <th className="px-3 py-2 font-medium text-right">Poin / pcs</th>
                <th className="px-3 py-2 font-medium w-20">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {itemRules.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-muted">
                    Belum ada aturan.
                  </td>
                </tr>
              )}
              {itemRules.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2">
                    {r.pattern} {r.isDefault && <span className="text-xs text-accent">(bawaan)</span>}
                  </td>
                  <td className="px-3 py-2 text-right">{formatNumber(r.points)}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => deleteItemRule(r.id)}
                      className="text-negative hover:underline"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-base font-semibold text-foreground mb-1">
          Item Dikecualikan dari Poin
        </h2>
        <p className="text-sm text-muted mb-4">
          Item yang tidak boleh dapat poin sama sekali — mengalahkan Daftar Poin per Item maupun
          Poin Default per Item Group manapun. Sama seperti di atas, nama/pola otomatis mencakup
          semua varian warna item tersebut.
        </p>

        <div className="flex flex-wrap items-end gap-2 mb-4">
          <div className="flex-1 min-w-56">
            <label className="block text-xs text-muted mb-1">Nama / Pola Item</label>
            <input
              type="text"
              value={itemExclusionInput}
              onChange={(e) => setItemExclusionInput(e.target.value)}
              placeholder="Contoh: Kabel Data ufone CB01-M"
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={addItemExclusion}
            className="rounded-md bg-accent text-accent-foreground px-3 py-1.5 text-sm font-medium hover:opacity-90"
          >
            + Kecualikan
          </button>
        </div>
        {itemExclusionError && <p className="text-sm text-negative mb-3">{itemExclusionError}</p>}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-background text-muted text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Nama / Pola Item</th>
                <th className="px-3 py-2 font-medium w-20">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {itemExclusions.length === 0 && (
                <tr>
                  <td colSpan={2} className="px-3 py-6 text-center text-muted">
                    Belum ada item yang dikecualikan.
                  </td>
                </tr>
              )}
              {itemExclusions.map((x) => (
                <tr key={x.id}>
                  <td className="px-3 py-2">{x.pattern}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => removeItemExclusion(x.id)}
                      className="text-negative hover:underline"
                    >
                      Sertakan Lagi
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-base font-semibold text-foreground mb-1">
          Poin Default per Item Group
        </h2>
        <p className="text-sm text-muted mb-4">
          Item yang tidak cocok dengan daftar di atas tapi Item Group-nya ada di sini tetap dapat
          poin sebesar ini (mis. semua item Aksesoris lain tetap dapat 5 poin).
        </p>

        <div className="flex flex-wrap items-end gap-2 mb-4">
          <div className="flex-1 min-w-56">
            <label className="block text-xs text-muted mb-1">Item Group POS</label>
            <input
              type="text"
              value={groupInput}
              onChange={(e) => setGroupInput(e.target.value)}
              placeholder="Contoh: ACC CAMPURAN NEW"
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <div className="w-28">
            <label className="block text-xs text-muted mb-1">Poin / pcs</label>
            <input
              type="number"
              value={groupPointsInput}
              min={0}
              step={1}
              onChange={(e) => setGroupPointsInput(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={addGroupRule}
            className="rounded-md bg-accent text-accent-foreground px-3 py-1.5 text-sm font-medium hover:opacity-90"
          >
            + Tambah
          </button>
        </div>
        {groupError && <p className="text-sm text-negative mb-3">{groupError}</p>}

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-background text-muted text-left">
              <tr>
                <th className="px-3 py-2 font-medium">Item Group POS</th>
                <th className="px-3 py-2 font-medium text-right">Poin / pcs</th>
                <th className="px-3 py-2 font-medium w-20">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {groupRules.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-muted">
                    Belum ada aturan.
                  </td>
                </tr>
              )}
              {groupRules.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2">{r.itemGroup}</td>
                  <td className="px-3 py-2 text-right">{formatNumber(r.points)}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => deleteGroupRule(r.id)}
                      className="text-negative hover:underline"
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
