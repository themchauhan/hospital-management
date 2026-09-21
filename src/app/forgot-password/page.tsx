import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Reset password — Hospital & USG Records" };

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-16 sm:px-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Enter the email your centre administrator has on file.
          </p>
        </div>
        <ForgotPasswordForm />
      </div>
    </main>
  );
}
