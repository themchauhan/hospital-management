import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Patients — Hospital & USG Records" };

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const supabase = await createClient();
  const { data: patients } = query
    ? await supabase.rpc("search_patients", { p_query: query })
    : await supabase
        .from("patients")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(50);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-16 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Patients</h1>
        <Link
          href="/dashboard/patients/new"
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700"
        >
          New patient
        </Link>
      </div>

      <form method="get" className="mt-6 flex max-w-md gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search by name, mobile, or patient code"
          aria-label="Search patients"
          className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
        />
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Search
        </button>
      </form>

      <div className="mt-8">
        {patients && patients.length > 0 ? (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="py-2 font-medium">Code</th>
                <th className="py-2 font-medium">Name</th>
                <th className="py-2 font-medium">Mobile</th>
                <th className="py-2 font-medium">Guardian</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((patient) => (
                <tr
                  key={patient.id}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                >
                  <td className="py-2">
                    <Link
                      href={`/dashboard/patients/${patient.id}`}
                      className="font-mono text-zinc-600 hover:underline dark:text-zinc-400"
                    >
                      {patient.patient_code}
                    </Link>
                  </td>
                  <td className="py-2">
                    <Link href={`/dashboard/patients/${patient.id}`} className="hover:underline">
                      {patient.name}
                    </Link>
                  </td>
                  <td className="py-2 text-zinc-600 dark:text-zinc-400">{patient.mobile ?? "—"}</td>
                  <td className="py-2 text-zinc-600 dark:text-zinc-400">
                    {patient.guardian_name ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {query ? `No patients match "${query}".` : "No patients registered yet."}
          </p>
        )}
      </div>
    </main>
  );
}
