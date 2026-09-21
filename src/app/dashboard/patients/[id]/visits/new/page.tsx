import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewVisitForm } from "@/components/visits/new-visit-form";

export const metadata: Metadata = { title: "New visit — Hospital & USG Records" };

export default async function NewVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: patientId } = await params;
  const supabase = await createClient();

  const [{ data: patient }, { data: visitTypes }, { data: doctors }] = await Promise.all([
    supabase
      .from("patients")
      .select("id, name")
      .eq("id", patientId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase.from("visit_types").select("id, name").eq("active", true).order("name"),
    supabase.from("doctors").select("id, name").eq("active", true).order("name"),
  ]);

  if (!patient) {
    notFound();
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-16 sm:px-6">
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{patient.name}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">New visit</h1>
      <div className="mt-8">
        <NewVisitForm
          patientId={patient.id}
          visitTypes={visitTypes ?? []}
          doctors={doctors ?? []}
        />
      </div>
    </main>
  );
}
