import { Suspense } from "react";
import { TransactionsClient } from "./TransactionsClient";

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted">Memuat...</div>}>
      <TransactionsClient />
    </Suspense>
  );
}
