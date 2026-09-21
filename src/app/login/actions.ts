"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";
import { safeNextPath } from "@/lib/auth/safe-redirect";

export interface LoginState {
  error?: string;
}

export async function signIn(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? ""));

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { error, data } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Incorrect email or password." };
  }

  // Password auth alone doesn't know about our own deactivation flag
  // (Phase 1c) — check it explicitly so a deactivated account gets a
  // clear reason rather than the generic "not set up" message below.
  // They already proved they know the password, so naming the real
  // reason here isn't an account-enumeration risk.
  const { data: statusRow } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", data.user.id)
    .maybeSingle();
  if (statusRow?.status === "INACTIVE") {
    await supabase.auth.signOut();
    return { error: "This account has been deactivated. Contact your centre administrator." };
  }

  const profile = await getSessionProfile();
  if (!profile) {
    await supabase.auth.signOut();
    return {
      error: "Your account isn't set up correctly. Contact your administrator.",
    };
  }

  redirect(next ?? (profile.isPlatformAdmin ? "/admin" : "/dashboard"));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
