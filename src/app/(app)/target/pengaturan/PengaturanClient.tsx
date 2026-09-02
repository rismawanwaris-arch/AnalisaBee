"use client";

import { useCallback, useEffect, useState } from "react";

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
interface OutletOption {
  id: number;
  name: string;
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

export function PengaturanClient() {
  const [perkonter, setPerkonter] = useState<Amounts | null>(null);
  const [all, setAll] = useState<Amounts | null>(null);
  const [targetBusy, setTargetBusy] = useState(false);
  const [targetSaved, setTargetSaved] = useState(false);

  const [outlets, setOutlets] = useState<OutletOption[]>([]);
  const [aliases, setAliases] = useState<AliasRow[]>([]);
  const [aliasFrom, setAliasFrom] = useState("");
  const [aliasTo, setAliasTo] = useState<string>("");
  const [aliasError, setAliasError] = useState<string | null>(null);

  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [groupFrom, setGroupFrom] = useState("");
  const [groupTo, setGroupTo] = useState<ReportCategory>("AKSESORIS");
  const [groupError, setGroupError] = useState<string | null>(null);

  const loadTargets = useCallback(async () => {
    const res = await fetch("/api/target");
    if (res.ok) {
      const data = await res.json();
      setPerkonter(data.perkonter);
      setAll(data.all);
    }
  }, []);

  const loadAliases = useCallback(async () => {
    const res = await fetch("/api/mappings/outlet-alias");
    if (res.ok) setAliases(await res.json());
  }, []);

  const loadGroups = useCallback(async () => {
    const res = await fetch("/api/mappings/item-group");
    if (res.ok) setGroups(await res.json());
  }, []);

  useEffect(() => {
    loadTargets();
    loadAliases();
    loadGroups();
    fetch("/api/outlets")
      .then((r) => r.json())
      .then((list: OutletOption[]) => {
        setOutlets(list);
        if (list.length > 0) setAliasTo(String(list[0].id));
      });
  }, [loadTargets, loadAliases, loadGroups]);

  async function saveTargets() {
    if (!perkonter || !all) return;
    setTargetBusy(true);
    setTargetSaved(false);
    const payload = [
      ...LINES.map((c) => ({ scope: "PERKONTER", category: c, amount: perkonter[c] })),
      ...LINES.map((c) => ({ scope: "ALL", category: c, amount: all[c] })),
    ];
    const res = await fetch("/api/target", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setTargetBusy(false);
    if (res.ok) {
      setTargetSaved(true);
      setTimeout(() => setTargetSaved(false), 2500);
    }
  }

  async function addAlias() {
    setAliasError(null);
    const alias = aliasFrom.trim().toUpperCase();
    if (!alias) {
      setAliasError("Nama alias tidak boleh kosong.");
      return;
    }
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
  }

  async function deleteAlias(id: number) {
    await fetch(`/api/mappings/outlet-alias/${id}`, { method: "DELETE" });
    await loadAliases();
  }

  async function addGroup() {
    setGroupError(null);
    const itemGroup = groupFrom.trim().toUpperCase();
    if (!itemGroup) {
      setGroupError("Nama Item Group tidak boleh kosong.");
      return;
    }
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
  }

  async function deleteGroup(id: number) {
    await fetch(`/api/mappings/item-group/${id}`, { method: "DELETE" });
    await loadGroups();
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-base font-semibold text-foreground mb-1">Target Harian</h2>
        <p className="text-sm text-muted mb-4">
          Target Perkonter menentukan warna lulus/gagal per outlet. Target All menentukan
          persentase pencapaian jaringan di footer laporan.
        </p>

        {!perkonter || !all ? (
          <div className="text-sm text-muted">Memuat...</div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">Target Perkonter (Rp)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {LINES.map((line) => (
                  <div key={line}>
                    <label className="block text-xs text-muted mb-1">{LINE_LABELS[line]}</label>
                    <input
                      type="number"
                      value={perkonter[line]}
                      step={1000}
                      onChange={(e) =>
                        setPerkonter({ ...perkonter, [line]: Number(e.target.value) || 0 })
                      }
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-foreground mb-2">Target All / Jaringan (Rp)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {LINES.map((line) => (
                  <div key={line}>
                    <label className="block text-xs text-muted mb-1">{LINE_LABELS[line]}</label>
                    <input
                      type="number"
                      value={all[line]}
                      step={10000}
                      onChange={(e) => setAll({ ...all, [line]: Number(e.target.value) || 0 })}
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 mt-4">
          <button
            type="button"
            onClick={saveTargets}
            disabled={targetBusy || !perkonter}
            className="rounded-md bg-accent text-accent-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {targetBusy ? "Menyimpan..." : "Simpan Target"}
          </button>
          {targetSaved && <span className="text-sm text-positive">Tersimpan.</span>}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="text-base font-semibold text-foreground mb-1">
          Mapping Nama Reseller → Outlet
        </h2>
        <p className="text-sm text-muted mb-4">
          Petakan nama yang muncul di file Tarik Tunai / Server (mis. <code>PARENT ...</code>) ke
          outlet POS resmi, supaya datanya masuk ke baris outlet yang benar.
        </p>

        <div className="flex flex-wrap items-end gap-2 mb-4">
          <div className="flex-1 min-w-48">
            <label className="block text-xs text-muted mb-1">Nama di File</label>
            <input
              type="text"
              value={aliasFrom}
              onChange={(e) => setAliasFrom(e.target.value)}
              placeholder="Contoh: PARENT CABANG BARU"
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex-1 min-w-48">
            <label className="block text-xs text-muted mb-1">Dipetakan ke Outlet</label>
            <select
              value={aliasTo}
              onChange={(e) => setAliasTo(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={addAlias}
            className="rounded-md bg-accent text-accent-foreground px-3 py-1.5 text-sm font-medium hover:opacity-90"
          >
            + Tambah
          </button>
        </div>
        {aliasError && <p className="text-sm text-negative mb-3">{aliasError}</p>}

        <div className="overflow-x-auto rounded-lg border border-border max-h-80 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-background text-muted text-left sticky top-0">
              <tr>
                <th className="px-3 py-2 font-medium">Nama di File</th>
                <th className="px-3 py-2 font-medium">Outlet</th>
                <th className="px-3 py-2 font-medium w-20">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {aliases.map((a) => (
                <tr key={a.id}>
                  <td className="px-3 py-2">
                    {a.alias} {a.isDefault && <span className="text-xs text-accent">(bawaan)</span>}
                  </td>
                  <td className="px-3 py-2">{a.outletName}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => deleteAlias(a.id)}
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
          Mapping Item Group POS → Kategori Laporan
        </h2>
        <p className="text-sm text-muted mb-4">
          Petakan nilai <code>Item Group</code> dari data POS ke salah satu dari 3 kategori laporan
          (Petshop / Aksesoris / SP-Voucher).
        </p>

        <div className="flex flex-wrap items-end gap-2 mb-4">
          <div className="flex-1 min-w-48">
            <label className="block text-xs text-muted mb-1">Nama Item Group di POS</label>
            <input
              type="text"
              value={groupFrom}
              onChange={(e) => setGroupFrom(e.target.value)}
              placeholder="Contoh: ACC SMARTPHONE"
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex-1 min-w-48">
            <label className="block text-xs text-muted mb-1">Masuk Kategori</label>
            <select
              value={groupTo}
              onChange={(e) => setGroupTo(e.target.value as ReportCategory)}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={addGroup}
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
                <th className="px-3 py-2 font-medium">Kategori</th>
                <th className="px-3 py-2 font-medium w-20">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {groups.map((g) => (
                <tr key={g.id}>
                  <td className="px-3 py-2">
                    {g.itemGroup} {g.isDefault && <span className="text-xs text-accent">(bawaan)</span>}
                  </td>
                  <td className="px-3 py-2">{g.category}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => deleteGroup(g.id)}
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
