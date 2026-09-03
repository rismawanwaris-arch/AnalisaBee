import React, { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { formatNumber, formatRupiah } from "@/lib/format";
import { yesterdayStr } from "@/lib/dateDefaults";

interface Figure {
  sales: number;
  qtyOrTrx: number;
}
interface ReportRow {
  outletId: number;
  outlet: string;
  server: Figure;
  tartun: Figure;
  petshop: Figure;
  aksesoris: Figure;
  spVoucher: Figure;
  totalSales: number;
  totalQtyTrx: number;
}
interface ReportResponse {
  rows: ReportRow[];
  targets: {
    all: Record<"SERVER" | "TARTUN" | "PETSHOP" | "AKSESORIS" | "SP_VOUCHER", number>;
  };
}

const LINE_COLORS: Record<string, string> = {
  Server: "var(--accent)",
  Tartun: "#7C5CFC",
  Petshop: "var(--positive)",
  Aksesoris: "#D97706",
  "SP/Voucher": "var(--negative)",
};

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  fontSize: 12,
  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
};

export function AnalitikPage() {
  const [date, setDate] = useState(yesterdayStr());
  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/target/report?date=${d}`);
      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // ignore fetch failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <DateBar date={date} setDate={setDate} onApply={() => load(date)} />
        <div className="text-xs text-muted flex items-center justify-center h-48 border border-dashed border-border/80 rounded-xl">
          Memuat data analitik...
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <DateBar date={date} setDate={setDate} onApply={() => load(date)} />
        <EmptyState />
      </div>
    );
  }

  const sums = data.rows.reduce(
    (acc, r) => {
      acc.server += r.server.sales;
      acc.tartun += r.tartun.sales;
      acc.petshop += r.petshop.sales;
      acc.aksesoris += r.aksesoris.sales;
      acc.spVoucher += r.spVoucher.sales;
      return acc;
    },
    { server: 0, tartun: 0, petshop: 0, aksesoris: 0, spVoucher: 0 }
  );

  const pieData = [
    { name: "Server", value: sums.server },
    { name: "Tartun", value: sums.tartun },
    { name: "Petshop", value: sums.petshop },
    { name: "Aksesoris", value: sums.aksesoris },
    { name: "SP/Voucher", value: sums.spVoucher },
  ].filter((d) => d.value > 0);

  const targetVsActual = [
    { name: "Server", realisasi: sums.server, target: data.targets?.all?.SERVER ?? 0 },
    { name: "Tartun", realisasi: sums.tartun, target: data.targets?.all?.TARTUN ?? 0 },
    { name: "Petshop", realisasi: sums.petshop, target: data.targets?.all?.PETSHOP ?? 0 },
    { name: "Aksesoris", realisasi: sums.aksesoris, target: data.targets?.all?.AKSESORIS ?? 0 },
    { name: "SP/Voucher", realisasi: sums.spVoucher, target: data.targets?.all?.SP_VOUCHER ?? 0 },
  ];

  const sortedBySales = [...(data.rows ?? [])].sort((a, b) => b.totalSales - a.totalSales);
  const top8 = sortedBySales.slice(0, 8);
  const bottom5 = sortedBySales.slice(-5).reverse();
  const comboOutlets = [...top8, ...bottom5].map((o, idx) => ({
    outlet: o.outlet,
    totalSales: o.totalSales,
    isTop: idx < top8.length,
  }));

  const scatterData = (data.rows ?? []).map((o) => ({
    x: o.totalQtyTrx,
    y: o.totalSales,
    outlet: o.outlet,
  }));

  return (
    <div className="space-y-4">
      <DateBar date={date} setDate={setDate} onApply={() => load(date)} />

      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title="Kontribusi Laba per Lini Bisnis" desc="Proporsi kontribusi omzet dan profit masing-masing lini bisnis">
          {pieData.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius="55%"
                  outerRadius="80%"
                  paddingAngle={3}
                  isAnimationActive={false}
                >
                  {pieData.map((d) => (
                    <Cell key={d.name} fill={LINE_COLORS[d.name] ?? "var(--accent)"} stroke="var(--surface)" strokeWidth={2} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: 11, color: "var(--foreground)" }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v, name) => [formatRupiah(Number(v)), String(name)]}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Realisasi vs Target All" desc="Perbandingan capaian riil jaringan terhadap baseline target harian">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={targetVsActual} margin={{ left: 8, right: 8, top: 12 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="name" fontSize={11} stroke="var(--border)" tick={{ fill: "var(--muted)", fontWeight: 500 }} />
              <YAxis fontSize={11} stroke="var(--border)" tick={{ fill: "var(--muted)" }} tickFormatter={(v) => formatNumber(v)} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatRupiah(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 11, color: "var(--foreground)" }} />
              <Bar dataKey="realisasi" name="Realisasi (Riil)" fill="var(--accent)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="target" name="Target Baseline" fill="#64748b" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top 8 vs Bottom 5 Outlet" desc="Perbandingan outlet dengan performa tertinggi vs terendah">
          <ResponsiveContainer width="100%" height={Math.max(280, comboOutlets.length * 28)}>
            <BarChart data={comboOutlets} layout="vertical" margin={{ left: 16, right: 20, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--chart-grid)" />
              <XAxis type="number" fontSize={11} stroke="var(--border)" tick={{ fill: "var(--muted)" }} tickFormatter={(v) => formatNumber(v)} />
              <YAxis type="category" dataKey="outlet" width={140} fontSize={11} stroke="var(--border)" tick={{ fill: "var(--foreground)", fontWeight: 500 }} interval={0} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatRupiah(Number(v))} />
              <Bar dataKey="totalSales" name="Total Sales" radius={[0, 6, 6, 0]}>
                {comboOutlets.map((o, i) => (
                  <Cell key={i} fill={o.isTop ? "var(--positive)" : "var(--negative)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Matriks Produktivitas Outlet" desc="Kuadran korelasi antara volume transaksi/pcs dan omzet profit">
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ left: 8, right: 16, top: 12, bottom: 8 }}>
              <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
              <XAxis
                type="number"
                dataKey="x"
                name="Total Aktivitas"
                fontSize={11}
                stroke="var(--border)"
                tick={{ fill: "var(--muted)" }}
                label={{ value: "Total Transaksi / PCS", position: "insideBottom", offset: -4, fontSize: 11, fill: "var(--muted)" }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Total Profit"
                fontSize={11}
                stroke="var(--border)"
                tick={{ fill: "var(--muted)" }}
                tickFormatter={(v) => formatNumber(v)}
              />
              <ZAxis range={[60, 60]} />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ strokeDasharray: "3 3" }}
                formatter={(v, name) => (name === "Total Profit" ? formatRupiah(Number(v)) : formatNumber(Number(v)))}
                labelFormatter={() => ""}
              />
              <Scatter data={scatterData} fill="var(--accent)" />
            </ScatterChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

function DateBar({
  date,
  setDate,
  onApply,
}: {
  date: string;
  setDate: (d: string) => void;
  onApply: () => void;
}) {
  return (
    <div className="rounded-xl border border-border/80 bg-surface p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold text-muted">Tanggal Analisis:</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-border/80 bg-surface-subtle px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
        />
        <button
          type="button"
          onClick={onApply}
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent text-accent-foreground px-3.5 py-1.5 text-xs font-semibold hover:bg-accent-hover transition-all shadow-xs"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>Tampilkan</span>
        </button>
      </div>
    </div>
  );
}

function ChartCard({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/80 bg-surface p-5 space-y-2 shadow-xs">
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">{title}</h3>
        <p className="text-[11px] text-muted">{desc}</p>
      </div>
      <div className="pt-2">{children}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-64 flex items-center justify-center text-xs text-muted border border-dashed border-border/80 rounded-xl">
      Tidak ada data penjualan pada tanggal ini.
    </div>
  );
}
