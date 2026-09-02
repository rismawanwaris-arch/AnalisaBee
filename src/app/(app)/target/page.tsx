import { Suspense } from "react";
import { TargetReportClient } from "./TargetReportClient";

export default function TargetReportPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted">Memuat...</div>}>
      <TargetReportClient />
    </Suspense>
  );
}
