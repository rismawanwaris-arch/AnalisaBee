import { Suspense } from "react";
import { AnalitikClient } from "./AnalitikClient";

export default function AnalitikPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted">Memuat...</div>}>
      <AnalitikClient />
    </Suspense>
  );
}
