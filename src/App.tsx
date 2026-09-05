import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { PeriodProvider } from "./context/PeriodContext";
import { ThemeProvider } from "./context/ThemeContext";
import { AppLayout } from "./components/AppLayout";
import { LoginPage } from "./pages/LoginPage";

const DashboardPage = lazy(() => import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const TargetLayout = lazy(() => import("./pages/target/TargetLayout").then((m) => ({ default: m.TargetLayout })));
const TargetReportPage = lazy(() => import("./pages/target/TargetReportPage").then((m) => ({ default: m.TargetReportPage })));
const AnalitikPage = lazy(() => import("./pages/target/AnalitikPage").then((m) => ({ default: m.AnalitikPage })));
const JamOperasionalPage = lazy(() => import("./pages/target/JamOperasionalPage").then((m) => ({ default: m.JamOperasionalPage })));
const PointsLayout = lazy(() => import("./pages/points/PointsLayout").then((m) => ({ default: m.PointsLayout })));
const PointsLeaderboardPage = lazy(() => import("./pages/points/PointsLeaderboardPage").then((m) => ({ default: m.PointsLeaderboardPage })));
const ItemsPage = lazy(() => import("./pages/items/ItemsPage").then((m) => ({ default: m.ItemsPage })));
const ItemsByCategoryPage = lazy(() => import("./pages/items/ItemsByCategoryPage").then((m) => ({ default: m.ItemsByCategoryPage })));
const OutletsPage = lazy(() => import("./pages/outlets/OutletsPage").then((m) => ({ default: m.OutletsPage })));
const OutletDetailPage = lazy(() => import("./pages/outlets/OutletDetailPage").then((m) => ({ default: m.OutletDetailPage })));
const EmployeesPage = lazy(() => import("./pages/employees/EmployeesPage").then((m) => ({ default: m.EmployeesPage })));
const EmployeeDetailPage = lazy(() => import("./pages/employees/EmployeeDetailPage").then((m) => ({ default: m.EmployeeDetailPage })));
const TransactionsPage = lazy(() => import("./pages/transactions/TransactionsPage").then((m) => ({ default: m.TransactionsPage })));
const ImportPage = lazy(() => import("./pages/import/ImportPage").then((m) => ({ default: m.ImportPage })));
const SettingsPage = lazy(() => import("./pages/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const ActivityLogPage = lazy(() => import("./pages/log/ActivityLogPage").then((m) => ({ default: m.ActivityLogPage })));

function PageLoader() {
  return (
    <div className="flex items-center justify-center p-16 text-xs text-muted">
      <span className="w-2 h-2 rounded-full bg-accent animate-ping mr-2" />
      Memuat halaman...
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PeriodProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public Login Route */}
              <Route path="/login" element={<LoginPage />} />

              {/* Protected Application Routes */}
              <Route element={<AppLayout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />

                {/* Target & Reports Section */}
                <Route path="/target" element={<TargetLayout />}>
                  <Route index element={<TargetReportPage />} />
                  <Route path="analitik" element={<AnalitikPage />} />
                  <Route path="jam-operasional" element={<JamOperasionalPage />} />
                  <Route path="pengaturan" element={<Navigate to="/settings?tab=target" replace />} />
                </Route>

                {/* Points & Incentives Section */}
                <Route path="/points" element={<PointsLayout />}>
                  <Route index element={<PointsLeaderboardPage />} />
                  <Route path="pengaturan" element={<Navigate to="/settings?tab=points" replace />} />
                </Route>

                {/* Dimension & Analysis Sections */}
                <Route path="/items" element={<ItemsPage />} />
                <Route path="/items/categories" element={<ItemsByCategoryPage />} />
                <Route path="/outlets" element={<OutletsPage />} />
                <Route path="/outlets/:id" element={<OutletDetailPage />} />
                <Route path="/employees" element={<EmployeesPage />} />
                <Route path="/employees/:id" element={<EmployeeDetailPage />} />
                <Route path="/transactions" element={<TransactionsPage />} />
                <Route path="/import" element={<ImportPage />} />

                {/* Activity Log */}
                <Route path="/log" element={<ActivityLogPage />} />

                {/* Centralized Settings (master only — guard in AppLayout) */}
                <Route path="/settings" element={<SettingsPage />} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        </PeriodProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
