import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/guards";
import { getMfaStatus } from "@/lib/auth/mfa";

export const metadata: Metadata = { title: "Platform admin — Hospital & USG Records" };

export default async function AdminPage() {
  const profile = await getSessionProfile();

  if (!profile) {
    redirect("/login?next=/admin");
  }
  if (!profile.isPlatformAdmin) {
    redirect("/dashboard");
  }

  requireRole(profile, ["SUPER_ADMIN"]);

  const mfaStatus = await getMfaStatus(profile.role);
  if (mfaStatus === "enroll_required") {
    redirect("/mfa/setup?next=/admin");
  }
  if (mfaStatus === "challenge_required") {
    redirect("/mfa/verify?next=/admin");
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-16 sm:px-6">
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Platform admin</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Super admin console</h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
        Signed in as {profile.name}. Centre provisioning and the subscription dashboard are built
        out in Phases 1c and 8. 
      </p>
    </main>  
  );
}
