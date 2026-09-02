"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCompactRupiah, formatDate, formatNumber, formatRupiah } from "@/lib/format";

interface TrendPoint {
  tanggal: string;
  qty: number;
  subtotal: number;
}

export function TrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="text-xs text-muted flex items-center justify-center h-56">
        Belum ada data.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="2 3" vertical={false} />
        <XAxis
          dataKey="tanggal"
          tickFormatter={(v) => formatDate(v)}
          tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--muted)" }}
          minTickGap={24}
          stroke="var(--border)"
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => formatCompactRupiah(Number(v))}
          tick={{ fontSize: 10, fontFamily: "var(--font-mono)", fill: "var(--muted)" }}
          width={64}
          stroke="var(--border)"
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            fontSize: 12,
          }}
          labelFormatter={(v) => formatDate(String(v))}
          formatter={(value, name) => [
            name === "subtotal" ? formatRupiah(Number(value)) : formatNumber(Number(value)),
            name === "subtotal" ? "Omzet" : "Qty",
          ]}
        />
        <Line
          type="monotone"
          dataKey="subtotal"
          stroke="var(--chart-line)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--chart-line)", strokeWidth: 0 }}
          activeDot={{ r: 4 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
