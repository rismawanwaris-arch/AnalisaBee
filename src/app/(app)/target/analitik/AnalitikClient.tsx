"use client";

import { useCallback, useEffect, useState } from "react";
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

export function AnalitikClient() {
  const [date, setDate] = useState(yesterdayStr());
  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    const res = await fetch(`/api/target/report?date=${d}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    load(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !data) {
    return (
      <div className="space-y-4">
        <DateBar date={date} setDate={setDate} onApply={() => load(date)} />
        <div className="text-sm text-muted">Memuat...</div>
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
    { name: "Server", realisasi: sums.server, target: data.targets.all.SERVER },
    { name: "Tartun", realisasi: sums.tartun, target: data.targets.all.TARTUN },
    { name: "Petshop", realisasi: sums.petshop, target: data.targets.all.PETSHOP },
    { name: "Aksesoris", realisasi: sums.aksesoris, target: data.targets.all.AKSESORIS },
    { name: "SP/Voucher", realisasi: sums.spVoucher, target: data.targets.all.SP_VOUCHER },
  ];

  const sortedBySales = [...data.rows].sort((a, b) => b.totalSales - a.totalSales);
  const top8 = sortedBySales.slice(0, 8);
  const bottom5 = sortedBySales.slice(-5).reverse();
  const comboOutlets = [...top8, ...bottom5].map((o, idx) => ({
    outlet: o.outlet,
    totalSales: o.totalSales,
    isTop: idx < top8.length,
  }));

  const scatterData = data.rows.map((o) => ({
    x: o.totalQtyTrx,
    y: o.totalSales,
    outlet: o.outlet,
  }));

  return (
    <div className="space-y-6">
      <DateBar date={date} setDate={setDate} onApply={() => load(date)} />

      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title="Kontribusi Laba per Lini Bisnis" desc="Persentase kontribusi keuntungan tiap lini bisnis.">
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
                  paddingAngle={2}
                  isAnimationActive={false}
                >
                  {pieData.map((d) => (
                    <Cell key={d.name} fill={LINE_COLORS[d.name]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v, name) => [formatRupiah(Number(v)), String(name)]}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Realisasi vs Target All" desc="Perbandingan realisasi jaringan terhadap Target All per kategori.">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={targetVsActual} margin={{ left: 8, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" fontSize={12} stroke="var(--muted)" />
              <YAxis fontSize={11} stroke="var(--muted)" tickFormatter={(v) => formatNumber(v)} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatRupiah(Number(v))} />
              <Legend />
              <Bar dataKey="realisasi" name="Realisasi" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="target" name="Target All" fill="var(--border)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top 8 vs Bottom 5 Outlet" desc="Outlet paling produktif vs paling rendah, by total sales.">
          <ResponsiveContainer width="100%" height={Math.max(280, comboOutlets.length * 26)}>
            <BarChart data={comboOutlets} layout="vertical" margin={{ left: 16, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
              <XAxis type="number" fontSize={11} stroke="var(--muted)" tickFormatter={(v) => formatNumber(v)} />
              <YAxis type="category" dataKey="outlet" width={130} fontSize={11} stroke="var(--muted)" interval={0} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatRupiah(Number(v))} />
              <Bar dataKey="totalSales" name="Total Sales" radius={[0, 4, 4, 0]}>
                {comboOutlets.map((o, i) => (
                  <Cell key={i} fill={o.isTop ? "var(--positive)" : "var(--negative)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Matriks Produktivitas Outlet" desc="Sumbu-X total transaksi/pcs, sumbu-Y total profit — memetakan kuadran operasional.">
          <ResponsiveContainer width="100%" height={280}>
            <ScatterChart margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
              <CartesianGrid stroke="var(--border)" />
              <XAxis
                type="number"
                dataKey="x"
                name="Total Aktivitas"
                fontSize={11}
                stroke="var(--muted)"
                label={{ value: "Total Transaksi / PCS", position: "insideBottom", offset: -4, fontSize: 11, fill: "var(--muted)" }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Total Profit"
                fontSize={11}
                stroke="var(--muted)"
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

const tooltipStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 13,
};

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
    <div className="rounded border border-border bg-surface p-4 flex items-end gap-3">
      <div>
        <label className="block text-xs text-muted mb-1">Tanggal</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-sm"
        />
      </div>
      <button
        type="button"
        onClick={onApply}
        className="rounded-md bg-accent text-accent-foreground px-3 py-1.5 text-sm font-medium hover:opacity-90"
      >
        Tampilkan
      </button>
    </div>
  );
}

function ChartCard({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-border bg-surface p-4">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      <p className="text-xs text-muted mb-2">{desc}</p>
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-64 flex items-center justify-center text-sm text-muted">
      Tidak ada data pada tanggal ini.
    </div>
  );
}
