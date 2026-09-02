import { NextResponse } from "next/server";
import { previewSalesFile } from "@/lib/importSales";
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
    const preview = await previewSalesFile(buffer);
    return NextResponse.json(preview);
  } catch (err) {
    console.error("Preview failed:", err);
    const message = err instanceof Error ? err.message : "Gagal membaca file.";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
