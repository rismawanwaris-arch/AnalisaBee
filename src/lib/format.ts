export function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

/** Short Rupiah for chart axis ticks: 25000000 -> "25Jt", 1500000000 -> "1,5M". */
export function formatCompactRupiah(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) {
    return `${sign}${trimZero(abs / 1_000_000_000)}M`;
  }
  if (abs >= 1_000_000) {
    return `${sign}${trimZero(abs / 1_000_000)}Jt`;
  }
  if (abs >= 1_000) {
    return `${sign}${trimZero(abs / 1_000)}rb`;
  }
  return `${sign}${abs}`;
}

function trimZero(n: number): string {
  const rounded = n >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
  return String(rounded).replace(".", ",");
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const date = typeof value === "string" ? new Date(value) : value;
  if (!date || Number.isNaN(date.getTime())) return "-";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(date);
  } catch {
    return "-";
  }
}
