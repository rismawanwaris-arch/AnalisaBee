import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  if (await isAuthenticated()) {
    redirect("/dashboard");
  }
  const params = await searchParams;
  const from = typeof params.from === "string" ? params.from : "/dashboard";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <span className="font-semibold tracking-tight text-2xl">
            Analisa<span className="text-accent">BEe</span>
          </span>
          <p className="text-sm text-muted mt-1">Masuk untuk mengakses dashboard.</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-6">
          <LoginForm redirectTo={from} />
        </div>
      </div>
    </div>
  );
}
