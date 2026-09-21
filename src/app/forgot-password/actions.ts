"use server";

import { createClient } from "@/lib/supabase/server";

export interface ForgotPasswordState {
  message?: string;
  error?: string;
}

export async function requestPasswordReset(
  _prevState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    return { error: "Enter your email address." };
  }

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/reset-password`,
  });

  // Same message whether or not the email is registered, so the
  // response can't be used to enumerate accounts.
  return { message: "If that email is registered, a reset link is on its way." };
}
