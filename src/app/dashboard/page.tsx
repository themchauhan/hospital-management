import type { Metadata } from "next";
import Link from "next/link";
import { getSessionProfile } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Dashboard — Hospital & USG Records" };

export default async function DashboardPage() {
  // Role/MFA gating already happened in dashboard/layout.tsx; this
  // call is a cheap cache() hit, not a re-fetch.
  const profile = await getSessionProfile();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-16 sm:px-6">
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
        {profile?.hospital?.name ?? "Your centre"}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Dashboard</h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
        Signed in as {profile?.name} (
        {profile?.role === "HOSPITAL_ADMIN" ? "Admin" : "Receptionist"}). Patient, visit, and
        document workflows are built out in later phases.
      </p>
      {profile?.role === "HOSPITAL_ADMIN" ? (
        <Link
          href="/dashboard/staff"
          className="mt-6 w-fit rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Manage staff →
        </Link>
      ) : null}
    </main>
  );
}
