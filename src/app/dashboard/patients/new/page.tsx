import type { Metadata } from "next";
import { PatientForm } from "@/components/patients/patient-form";
import { createPatient } from "@/app/dashboard/patients/actions";

export const metadata: Metadata = { title: "New patient — Hospital & USG Records" };

export default function NewPatientPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">New patient</h1>
      <div className="mt-8">
        <PatientForm action={createPatient} submitLabel="Create patient" />
      </div>
    </main>
  );
}
