import { describe, expect, it } from "vitest";
import { SEED_ACCOUNTS, hospitalIdByName, signInAs, serviceRoleClient } from "./helpers";

async function createUsgVisit(staffEmail: string, hospitalName: string) {
  const staff = await signInAs(staffEmail);
  const hospitalId = await hospitalIdByName(hospitalName);

  const { data: visitType, error: visitTypeError } = await staff
    .from("visit_types")
    .select("id")
    .eq("hospital_id", hospitalId)
    .eq("name", "General USG")
    .single();
  if (visitTypeError || !visitType) throw visitTypeError ?? new Error("General USG not found");

  const { data: patient, error: patientError } = await staff
    .from("patients")
    .insert({ name: "USG Workflow Test Patient" })
    .select()
    .single();
  if (patientError || !patient) throw patientError ?? new Error("failed to create patient");

  const { data: visit, error: visitError } = await staff
    .from("visits")
    .insert({ patient_id: patient.id, visit_type_id: visitType.id })
    .select()
    .single();
  if (visitError || !visit) throw visitError ?? new Error("failed to create visit");

  return { staff, visit, hospitalId };
}

describe("USG workflow status transitions RLS", () => {
  it("same-hospital staff can move a visit SCHEDULED -> IN_PROGRESS -> COMPLETED", async () => {
    const { staff, visit } = await createUsgVisit(
      SEED_ACCOUNTS.clarity.receptionist,
      "Clarity Diagnostics",
    );
    expect(visit.status).toBe("SCHEDULED");

    const { error: toInProgressError } = await staff
      .from("visits")
      .update({ status: "IN_PROGRESS" })
      .eq("id", visit.id);
    expect(toInProgressError).toBeNull();

    const { error: toCompletedError } = await staff
      .from("visits")
      .update({ status: "COMPLETED" })
      .eq("id", visit.id);
    expect(toCompletedError).toBeNull();

    const { data: final } = await serviceRoleClient()
      .from("visits")
      .select("status")
      .eq("id", visit.id)
      .single();
    expect(final?.status).toBe("COMPLETED");
  });

  it("cross-tenant: another hospital's staff cannot move this visit's status", async () => {
    const { visit } = await createUsgVisit(
      SEED_ACCOUNTS.clarity.receptionist,
      "Clarity Diagnostics",
    );
    const wellspringStaff = await signInAs(SEED_ACCOUNTS.wellspring.receptionist);

    const { data, error } = await wellspringStaff
      .from("visits")
      .update({ status: "IN_PROGRESS" })
      .eq("id", visit.id)
      .select();
    expect(data ?? []).toHaveLength(0);
    expect(error).toBeNull(); // RLS silently matches zero rows, not an error.

    const { data: unchanged } = await serviceRoleClient()
      .from("visits")
      .select("status")
      .eq("id", visit.id)
      .single();
    expect(unchanged?.status).toBe("SCHEDULED");
  });

  it("the USG dashboard's query never returns another hospital's visits", async () => {
    const clarity = await createUsgVisit(SEED_ACCOUNTS.clarity.receptionist, "Clarity Diagnostics");
    const wellspring = await createUsgVisit(
      SEED_ACCOUNTS.wellspring.receptionist,
      "Wellspring Multispecialty",
    );

    const clarityStaff = await signInAs(SEED_ACCOUNTS.clarity.receptionist);
    const { data: visits } = await clarityStaff
      .from("visits")
      .select("id, visit_types!inner(module)")
      .eq("visit_types.module", "USG");

    const visitIds = new Set((visits ?? []).map((v) => v.id));
    expect(visitIds.has(clarity.visit.id)).toBe(true);
    expect(visitIds.has(wellspring.visit.id)).toBe(false);
  });
});
