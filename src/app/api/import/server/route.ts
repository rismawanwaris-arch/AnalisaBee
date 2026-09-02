import { NextResponse } from "next/server";
import { parseServerBuffer, parseServerText } from "@/lib/parseTartunServer";
import { importDailyMetric } from "@/lib/importTartunServer";
import { validateUploadedFile } from "@/lib/uploadValidation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  const text = formData.get("text");
  const dateStr = formData.get("date");

  if (typeof dateStr !== "string" || !dateStr) {
    return NextResponse.json({ error: "Tanggal wajib diisi." }, { status: 400 });
  }
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Tanggal tidak valid." }, { status: 400 });
  }

  try {
    let parsed: ReturnType<typeof parseServerText>;
    let filename = "teks tempel";

    if (file instanceof File) {
      const validationError = validateUploadedFile(file);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      parsed = parseServerBuffer(buffer);
      filename = file.name;
    } else if (typeof text === "string" && text.trim()) {
      parsed = parseServerText(text);
    } else {
      return NextResponse.json({ error: "Isi teks atau unggah file terlebih dahulu." }, { status: 400 });
    }

    const summary = await importDailyMetric("SERVER", date, parsed.rows);
    return NextResponse.json({
      filename,
      parsedRows: parsed.rows.length,
      parseErrors: parsed.errors,
      ...summary,
    });
  } catch (err) {
    console.error("Server import failed:", err);
    const message = err instanceof Error ? err.message : "Gagal memproses data.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
