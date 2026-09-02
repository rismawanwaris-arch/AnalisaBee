import { NextResponse } from "next/server";
import { parseTartunBuffer } from "@/lib/parseTartunServer";
import { importDailyMetric } from "@/lib/importTartunServer";
import { validateUploadedFile } from "@/lib/uploadValidation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const dateStr = formData.get("date");

  if (typeof dateStr !== "string" || !dateStr) {
    return NextResponse.json({ error: "Tanggal wajib diisi." }, { status: 400 });
  }
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Tanggal tidak valid." }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File tidak ditemukan pada request." }, { status: 400 });
  }
  const validationError = validateUploadedFile(file);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { rows, errors } = parseTartunBuffer(buffer);
    const summary = await importDailyMetric("TARTUN", date, rows);
    return NextResponse.json({ filename: file.name, parsedRows: rows.length, parseErrors: errors, ...summary });
  } catch (err) {
    console.error("Tartun import failed:", err);
    const message = err instanceof Error ? err.message : "Gagal memproses file.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
