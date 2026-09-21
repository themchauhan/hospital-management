import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Dashboard — Hospital & USG Records" };

export default async function DashboardPage() {
  const profile = await getSessionProfile();

  if (!profile) {
    redirect("/login?next=/dashboard");
  }
  if (profile.isPlatformAdmin) {
    redirect("/admin");
  }

  // Redundant with the branches above (a non-platform-admin profile is
  // always HOSPITAL_ADMIN or RECEPTIONIST) but kept explicit so this
  // page follows the same requireRole() pattern every later phase's
  // protected routes/actions are expected to use.
  requireRole(profile, ["HOSPITAL_ADMIN", "RECEPTIONIST"]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-16 sm:px-6">
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
        {profile.hospital?.name ?? "Your centre"}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
        Signed in as {profile.name} ({profile.role === "HOSPITAL_ADMIN" ? "Admin" : "Receptionist"}
        ). Patient, visit, and document workflows are built out in later phases.
      </p>
    </main>
  );
}
