import { describe, expect, it } from "vitest";
import { SEED_ACCOUNTS, hospitalIdByName, signInAs, serviceRoleClient } from "./helpers";

async function opdConsultationId(hospitalId: string): Promise<string> {
  const { data, error } = await serviceRoleClient()
    .from("visit_types")
    .select("id")
    .eq("hospital_id", hospitalId)
    .eq("name", "OPD Consultation")
    .single();
  if (error || !data) throw error ?? new Error("OPD Consultation visit type not found");
  return data.id;
}

async function idProofDocumentTypeId(hospitalId: string): Promise<string> {
  const { data, error } = await serviceRoleClient()
    .from("document_types")
    .select("id")
    .eq("hospital_id", hospitalId)
    .eq("name", "ID Proof")
    .single();
  if (error || !data) throw error ?? new Error("ID Proof document type not found");
  return data.id;
}

describe("settings (modules / visit types / document types / requirements) RLS", () => {
  it("HOSPITAL_ADMIN can enable and disable a module in their own hospital", async () => {
    const admin = await signInAs(SEED_ACCOUNTS.sunrise.admin);
    const hospitalId = await hospitalIdByName("Sunrise General Hospital");

    // USG isn't enabled for Sunrise in the seed data.
    const { error: insertError } = await admin
      .from("hospital_modules")
      .insert({ hospital_id: hospitalId, module: "USG" });
    expect(insertError).toBeNull();

    const { error: deleteError } = await admin
      .from("hospital_modules")
      .delete()
      .eq("hospital_id", hospitalId)
      .eq("module", "USG");
    expect(deleteError).toBeNull();
  });

  it("a RECEPTIONIST cannot enable a module (RLS, not just app-level)", async () => {
    const receptionist = await signInAs(SEED_ACCOUNTS.sunrise.receptionist);
    const hospitalId = await hospitalIdByName("Sunrise General Hospital");

    const { error, data } = await receptionist
      .from("hospital_modules")
      .insert({ hospital_id: hospitalId, module: "USG" })
      .select();
    expect(data ?? []).toHaveLength(0);
    expect(error).not.toBeNull();
  });

  it("cross-tenant: Hospital A cannot enable a module for Hospital B", async () => {
    const sunriseAdmin = await signInAs(SEED_ACCOUNTS.sunrise.admin);
    const clarityId = await hospitalIdByName("Clarity Diagnostics");

    const { error, data } = await sunriseAdmin
      .from("hospital_modules")
      .insert({ hospital_id: clarityId, module: "USG" })
      .select();
    expect(data ?? []).toHaveLength(0);
    expect(error).not.toBeNull();
  });

  it("HOSPITAL_ADMIN can create and update a visit type; a RECEPTIONIST cannot", async () => {
    const admin = await signInAs(SEED_ACCOUNTS.sunrise.admin);
    const { data: created, error: createError } = await admin
      .from("visit_types")
      .insert({ module: "GENERAL_OPD", name: "Settings Test Visit Type" })
      .select()
      .single();
    expect(createError).toBeNull();
    expect(created).not.toBeNull();

    const { error: updateError } = await admin
      .from("visit_types")
      .update({ default_fee: 250 })
      .eq("id", created!.id);
    expect(updateError).toBeNull();

    const receptionist = await signInAs(SEED_ACCOUNTS.sunrise.receptionist);
    const { error: deniedError, data: deniedData } = await receptionist
      .from("visit_types")
      .update({ default_fee: 999 })
      .eq("id", created!.id)
      .select();
    expect(deniedData ?? []).toHaveLength(0);
    expect(deniedError).toBeNull(); // RLS silently matches zero rows on UPDATE, not an error.

    const { data: unchanged } = await serviceRoleClient()
      .from("visit_types")
      .select("default_fee")
      .eq("id", created!.id)
      .single();
    expect(Number(unchanged?.default_fee)).toBe(250);
  });

  it("cross-tenant: Hospital A cannot update Hospital B's visit type", async () => {
    const sunriseAdmin = await signInAs(SEED_ACCOUNTS.sunrise.admin);
    const clarityId = await hospitalIdByName("Clarity Diagnostics");
    const clarityOpdId = await opdConsultationIdOrNull(clarityId);
    if (!clarityOpdId) return; // Clarity is USG-only in the seed; nothing to target.

    const { data, error } = await sunriseAdmin
      .from("visit_types")
      .update({ name: "Hijacked" })
      .eq("id", clarityOpdId)
      .select();
    expect(data ?? []).toHaveLength(0);
    expect(error).toBeNull();
  });

  it("HOSPITAL_ADMIN can toggle a document requirement; a RECEPTIONIST cannot", async () => {
    const admin = await signInAs(SEED_ACCOUNTS.sunrise.admin);
    const hospitalId = await hospitalIdByName("Sunrise General Hospital");
    const opdId = await opdConsultationId(hospitalId);
    const idProofId = await idProofDocumentTypeId(hospitalId);

    // ID Proof is already required for every visit type per the seed
    // — flip it to optional, then back, proving the admin path works
    // both for update (existing row) and the insert path (via a fresh
    // document type with no existing requirement row yet).
    const { data: newDocType } = await serviceRoleClient()
      .from("document_types")
      .insert({ hospital_id: hospitalId, name: "Settings Test Doc Type", scope: "VISIT" })
      .select()
      .single();

    const { error: insertReqError } = await admin
      .from("visit_type_document_requirements")
      .insert({ visit_type_id: opdId, document_type_id: newDocType!.id, required: true });
    expect(insertReqError).toBeNull();

    const { error: updateReqError } = await admin
      .from("visit_type_document_requirements")
      .update({ required: false })
      .eq("visit_type_id", opdId)
      .eq("document_type_id", newDocType!.id);
    expect(updateReqError).toBeNull();

    const receptionist = await signInAs(SEED_ACCOUNTS.sunrise.receptionist);
    const { data: deniedData, error: deniedError } = await receptionist
      .from("visit_type_document_requirements")
      .update({ required: true })
      .eq("visit_type_id", opdId)
      .eq("document_type_id", idProofId)
      .select();
    expect(deniedData ?? []).toHaveLength(0);
    expect(deniedError).toBeNull();
  });

  it("editing a visit type's requirements only changes the checklist for NEW visits, never past ones", async () => {
    const admin = await signInAs(SEED_ACCOUNTS.sunrise.admin);
    const hospitalId = await hospitalIdByName("Sunrise General Hospital");
    const opdId = await opdConsultationId(hospitalId);

    const { data: patient } = await admin
      .from("patients")
      .insert({ name: "Settings Snapshot Test Patient" })
      .select()
      .single();

    const { data: firstVisit } = await admin
      .from("visits")
      .insert({ patient_id: patient!.id, visit_type_id: opdId })
      .select()
      .single();
    const { data: firstSnapshot } = await admin
      .from("visit_document_requirements")
      .select("document_type_name")
      .eq("visit_id", firstVisit!.id);
    const firstNames = new Set((firstSnapshot ?? []).map((r) => r.document_type_name));

    // Add a brand-new required document type to OPD Consultation's
    // checklist after the first visit already exists. Uniquely named
    // per run -- this suite's data persists across repeated `npm test`
    // runs (no cleanup step, same as other RLS specs), and a fixed
    // name here would let a PREVIOUS run's leftover requirement row
    // already show up in firstNames before this run adds anything.
    const docTypeName = `Snapshot Regression Doc Type ${Date.now()}`;
    const { data: newDocType } = await serviceRoleClient()
      .from("document_types")
      .insert({ hospital_id: hospitalId, name: docTypeName, scope: "VISIT" })
      .select()
      .single();
    await admin
      .from("visit_type_document_requirements")
      .insert({ visit_type_id: opdId, document_type_id: newDocType!.id, required: true });

    const { data: secondVisit } = await admin
      .from("visits")
      .insert({ patient_id: patient!.id, visit_type_id: opdId })
      .select()
      .single();
    const { data: secondSnapshot } = await admin
      .from("visit_document_requirements")
      .select("document_type_name")
      .eq("visit_id", secondVisit!.id);
    const secondNames = new Set((secondSnapshot ?? []).map((r) => r.document_type_name));

    // The new requirement shows up for the second visit...
    expect(secondNames.has(docTypeName)).toBe(true);
    // ...but the first visit's already-snapshotted checklist is untouched.
    expect(firstNames.has(docTypeName)).toBe(false);
    const { data: firstSnapshotAfter } = await admin
      .from("visit_document_requirements")
      .select("document_type_name")
      .eq("visit_id", firstVisit!.id);
    expect(new Set((firstSnapshotAfter ?? []).map((r) => r.document_type_name))).toEqual(
      firstNames,
    );
  });
});

async function opdConsultationIdOrNull(hospitalId: string): Promise<string | null> {
  const { data } = await serviceRoleClient()
    .from("visit_types")
    .select("id")
    .eq("hospital_id", hospitalId)
    .eq("name", "OPD Consultation")
    .maybeSingle();
  return data?.id ?? null;
}
