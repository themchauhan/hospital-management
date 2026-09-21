import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { getMfaStatus } from "@/lib/auth/mfa";
import { safeNextPath } from "@/lib/auth/safe-redirect";
import { MfaVerifyForm } from "@/components/mfa/mfa-verify-form";

export const metadata: Metadata = { title: "Verify two-factor authentication" };

export default async function MfaVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const profile = await getSessionProfile();
  if (!profile) {
    redirect("/login");
  }

  const next = safeNextPath((await searchParams).next) ?? "/dashboard";
  const status = await getMfaStatus(profile.role);

  if (status === "not_required" || status === "satisfied") {
    redirect(next);
  }
  if (status === "enroll_required") {
    redirect(`/mfa/setup?next=${encodeURIComponent(next)}`);
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-16 sm:px-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Verify it&apos;s you</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Enter the code from your authenticator app.
          </p>
        </div>
        <MfaVerifyForm next={next} />
      </div>
    </main>
  );
}
