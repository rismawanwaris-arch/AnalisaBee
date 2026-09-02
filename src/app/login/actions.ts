"use server";

import { redirect } from "next/navigation";
import { createSession, verifyPassword } from "@/lib/session";

export interface LoginState {
  error?: string;
}

export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/dashboard");

  if (!password) {
    return { error: "Password wajib diisi." };
  }

  let ok: boolean;
  try {
    ok = verifyPassword(password);
  } catch {
    return { error: "Konfigurasi APP_PASSWORD belum diset di server." };
  }

  if (!ok) {
    return { error: "Password salah." };
  }

  await createSession();
  redirect(redirectTo.startsWith("/") ? redirectTo : "/dashboard");
}
