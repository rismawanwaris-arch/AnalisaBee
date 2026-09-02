import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { getSystemStatus } from "@/lib/queries/systemStatus";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const status = await getSystemStatus();

  return (
    <div className="flex min-h-screen items-start">
      <Sidebar status={status} />
      {/* min-w-0 keeps a wide table inside its own scroller instead of widening
          the flex row and pushing the layout out from under the sidebar. */}
      <div className="flex-1 flex flex-col min-w-0 self-stretch">
        <Topbar />
        <main className="flex-1 px-4 py-4 md:px-5 md:py-5 max-w-[1680px] w-full space-y-4">
          {children}
        </main>
      </div>
    </div>
  );
}
