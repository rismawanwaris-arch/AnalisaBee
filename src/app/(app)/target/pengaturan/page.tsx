import { Suspense } from "react";
import { PengaturanClient } from "./PengaturanClient";

export default function PengaturanPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted">Memuat...</div>}>
      <PengaturanClient />
    </Suspense>
  );
}
