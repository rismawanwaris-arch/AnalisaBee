import { Suspense } from "react";
import { PointsSettingsClient } from "./PointsSettingsClient";

export default function PointsSettingsPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted">Memuat...</div>}>
      <PointsSettingsClient />
    </Suspense>
  );
}
