import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { getSystemStatus } from "@/lib/queries/systemStatus";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const status = await getSystemStatus();

  return (
    <div className="min-h-screen">
      <Sidebar status={status} />
      <div className="md:ml-60 flex flex-col min-h-screen min-w-0">
        <Topbar />
        <main className="flex-1 px-4 py-4 md:px-5 md:py-5 max-w-[1680px] w-full space-y-4">
          {children}
        </main>
      </div>
    </div>
  );
}
