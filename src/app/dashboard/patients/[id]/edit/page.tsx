import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updatePatient } from "@/app/dashboard/patients/actions";
import { PatientForm } from "@/components/patients/patient-form";

export const metadata: Metadata = { title: "Edit patient — Hospital & USG Records" };

export default async function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
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
      <h1 className="text-3xl font-semibold tracking-tight">Edit {patient.name}</h1>
      <div className="mt-8">
        <PatientForm
          action={updatePatient.bind(null, patient.id)}
          submitLabel="Save changes"
          defaults={{
            name: patient.name,
            mobile: patient.mobile,
            dob: patient.dob,
            approximateAgeYears: patient.approximate_age_years,
            guardianName: patient.guardian_name,
            gender: patient.gender,
            address: patient.address,
          }}
        />
      </div>
    </main>
  );
}
