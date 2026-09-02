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
import { formatDate, formatNumber, formatRupiah } from "@/lib/format";

interface TrendPoint {
  tanggal: string;
  qty: number;
  subtotal: number;
}

export function TrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="text-sm text-muted flex items-center justify-center h-56">
        Belum ada data.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ left: 12, right: 12, top: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="tanggal"
          tickFormatter={(v) => formatDate(v)}
          fontSize={12}
          minTickGap={24}
          stroke="var(--muted)"
        />
        <YAxis tickFormatter={(v) => formatNumber(v)} fontSize={12} width={70} stroke="var(--muted)" />
        <Tooltip
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 13,
          }}
          labelFormatter={(v) => formatDate(String(v))}
          formatter={(value, name) => [
            name === "subtotal" ? formatRupiah(Number(value)) : formatNumber(Number(value)),
            name === "subtotal" ? "Omzet" : "Qty",
          ]}
        />
        <Line type="monotone" dataKey="subtotal" stroke="var(--accent)" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
