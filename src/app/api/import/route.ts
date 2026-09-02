import { NextResponse } from "next/server";
import { importSalesFile } from "@/lib/importSales";
import { validateUploadedFile } from "@/lib/uploadValidation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File tidak ditemukan pada request." }, { status: 400 });
  }

  const validationError = validateUploadedFile(file);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const summary = await importSalesFile(file.name, buffer);
    return NextResponse.json(summary, { status: 201 });
  } catch (err) {
    console.error("Import failed:", err);
    const message = err instanceof Error ? err.message : "Gagal memproses file.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
