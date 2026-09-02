import { Suspense } from "react";
import { LeaderboardClient } from "./LeaderboardClient";

export default function PointsLeaderboardPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted">Memuat...</div>}>
      <LeaderboardClient />
    </Suspense>
  );
}
