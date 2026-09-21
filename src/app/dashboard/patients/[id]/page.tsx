import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Patient — Hospital & USG Records" };

function formatDob(dob: string | null, approximateAgeYears: number | null): string {
  if (dob) {
    const age = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    return `${dob} (age ${age})`;
  }
  if (approximateAgeYears !== null) {
    return `Unknown — approximately ${approximateAgeYears} years old`;
  }
  return "Unknown";
}

export default async function PatientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!patient) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-16 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-zinc-500 dark:text-zinc-400">
            {patient.patient_code}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">{patient.name}</h1>
        </div>
        <Link
          href={`/dashboard/patients/${patient.id}/edit`}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Edit
        </Link>
      </div>

      <dl className="mt-8 grid max-w-lg grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
        <dt className="text-zinc-500 dark:text-zinc-400">Mobile</dt>
        <dd>{patient.mobile ?? "—"}</dd>

        <dt className="text-zinc-500 dark:text-zinc-400">Date of birth</dt>
        <dd>{formatDob(patient.dob, patient.approximate_age_years)}</dd>

        <dt className="text-zinc-500 dark:text-zinc-400">Gender</dt>
        <dd>{patient.gender ?? "—"}</dd>

        <dt className="text-zinc-500 dark:text-zinc-400">Guardian</dt>
        <dd>{patient.guardian_name ?? "—"}</dd>

        <dt className="text-zinc-500 dark:text-zinc-400">Address</dt>
        <dd>{patient.address ?? "—"}</dd>
      </dl>

      <div className="mt-12 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Visits</h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Visit history is built out in Phase 3.
        </p>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold">Documents</h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Document upload is built out in Phase 4.
        </p>
      </div>
    </main>
  );
}
