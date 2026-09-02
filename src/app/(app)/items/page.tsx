import { Suspense } from "react";
import { ItemExplorer } from "./ItemExplorer";

export default function ItemsPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted">Memuat...</div>}>
      <ItemExplorer />
    </Suspense>
  );
}
