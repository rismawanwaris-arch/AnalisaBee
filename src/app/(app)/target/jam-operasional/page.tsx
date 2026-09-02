import { Suspense } from "react";
import { JamOperasionalClient } from "./JamOperasionalClient";

export default function JamOperasionalPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted">Memuat...</div>}>
      <JamOperasionalClient />
    </Suspense>
  );
}
