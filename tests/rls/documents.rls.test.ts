import { describe, expect, it } from "vitest";
import { SEED_ACCOUNTS, hospitalIdByName, signInAs } from "./helpers";

// A minimal valid JPEG (just the magic bytes + a little padding) —
// enough for Storage to accept as bytes; these tests exercise RLS,
// not the app's own magic-byte/EXIF validation (covered by
// src/lib/documents/file-validation.test.ts).
const FAKE_JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

async function makeSunrisePatientWithIdProof(sunrise: Awaited<ReturnType<typeof signInAs>>) {
  const { data: patient, error: patientError } = await sunrise
    .from("patients")
    .insert({ name: "Document Test Patient" })
    .select()
    .single();
  if (patientError || !patient) throw patientError ?? new Error("failed to create patient");

  const { data: idProofType, error: typeError } = await sunrise
    .from("document_types")
    .select("id")
    .eq("name", "ID Proof")
    .single();
  if (typeError || !idProofType) throw typeError ?? new Error("ID Proof document type not found");

  const storagePath = `${patient.hospital_id}/${patient.id}/${crypto.randomUUID()}.jpg`;
  const { error: uploadError } = await sunrise.storage
    .from("documents")
    .upload(storagePath, FAKE_JPEG, { contentType: "image/jpeg" });
  if (uploadError) throw uploadError;

  const { data: document, error: documentError } = await sunrise
    .from("documents")
    .insert({
      patient_id: patient.id,
      document_type_id: idProofType.id,
      file_name: "id-proof.jpg",
      file_type: "image/jpeg",
      storage_path: storagePath,
      file_size: FAKE_JPEG.byteLength,
      sha256: "test-hash",
    })
    .select()
    .single();
  if (documentError || !document) throw documentError ?? new Error("failed to insert document");

  return { patient, document, storagePath };
}

describe("documents RLS", () => {
  it("happy path: authorized staff can upload and retrieve a document", async () => {
    const sunrise = await signInAs(SEED_ACCOUNTS.sunrise.receptionist);
    const { document, storagePath } = await makeSunrisePatientWithIdProof(sunrise);

    const { data: reopened } = await sunrise
      .from("documents")
      .select("*")
      .eq("id", document.id)
      .single();
    expect(reopened?.id).toBe(document.id);

    const { data: signed, error: signError } = await sunrise.storage
      .from("documents")
      .createSignedUrl(storagePath, 60);
    expect(signError).toBeNull();
    expect(signed?.signedUrl).toBeTruthy();

    const response = await fetch(signed!.signedUrl);
    expect(response.ok).toBe(true);
  });

  it("cross-tenant: another hospital cannot see the document row", async () => {
    const sunrise = await signInAs(SEED_ACCOUNTS.sunrise.receptionist);
    const { document } = await makeSunrisePatientWithIdProof(sunrise);

    const clarity = await signInAs(SEED_ACCOUNTS.clarity.admin);
    const { data } = await clarity.from("documents").select("*").eq("id", document.id);
    expect(data).toHaveLength(0);
  });

  it("cross-tenant: another hospital cannot read the Storage object even with the exact leaked path", async () => {
    const sunrise = await signInAs(SEED_ACCOUNTS.sunrise.receptionist);
    const { storagePath } = await makeSunrisePatientWithIdProof(sunrise);

    const clarity = await signInAs(SEED_ACCOUNTS.clarity.admin);
    const { data, error } = await clarity.storage
      .from("documents")
      .createSignedUrl(storagePath, 60);
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("cross-tenant: cannot upload into another hospital's folder even with a forged path", async () => {
    const sunrise = await signInAs(SEED_ACCOUNTS.sunrise.receptionist);
    const clarityId = await hospitalIdByName("Clarity Diagnostics");

    const { error } = await sunrise.storage
      .from("documents")
      .upload(`${clarityId}/${crypto.randomUUID()}/${crypto.randomUUID()}.jpg`, FAKE_JPEG, {
        contentType: "image/jpeg",
      });
    expect(error).not.toBeNull();
  });

  it("signed URLs expire and stop working after expiry", async () => {
    const sunrise = await signInAs(SEED_ACCOUNTS.sunrise.receptionist);
    const { storagePath } = await makeSunrisePatientWithIdProof(sunrise);

    const { data: signed } = await sunrise.storage
      .from("documents")
      .createSignedUrl(storagePath, 1);
    expect(signed?.signedUrl).toBeTruthy();

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const response = await fetch(signed!.signedUrl);
    expect(response.ok).toBe(false);
  });

  it("no DELETE or UPDATE policy exists — documents are never hard-deleted or silently altered", async () => {
    const sunrise = await signInAs(SEED_ACCOUNTS.sunrise.receptionist);
    const { document } = await makeSunrisePatientWithIdProof(sunrise);

    const { data: deleted } = await sunrise
      .from("documents")
      .delete()
      .eq("id", document.id)
      .select();
    expect(deleted).toHaveLength(0);

    const { data: updated } = await sunrise
      .from("documents")
      .update({ file_name: "tampered.jpg" })
      .eq("id", document.id)
      .select();
    expect(updated).toHaveLength(0);
  });

  it("patient-level documents (e.g. ID Proof) fulfil a visit's requirement across visits", async () => {
    const sunrise = await signInAs(SEED_ACCOUNTS.sunrise.receptionist);
    const { patient } = await makeSunrisePatientWithIdProof(sunrise);

    const { data: opdType } = await sunrise
      .from("visit_types")
      .select("id")
      .eq("name", "OPD Consultation")
      .single();
    const { data: visit } = await sunrise
      .from("visits")
      .insert({ patient_id: patient.id, visit_type_id: opdType!.id })
      .select()
      .single();

    // ID Proof is required (seeded against every visit type) and was
    // already uploaded at the PATIENT level, not against this visit —
    // OPD Consultation snapshots more than one requirement (ID Proof
    // + OPD Slip), so find the ID Proof one specifically.
    const { data: patientDocs } = await sunrise
      .from("documents")
      .select("document_type_id")
      .eq("patient_id", patient.id);
    const { data: idProofRequirement } = await sunrise
      .from("visit_document_requirements")
      .select("document_type_id")
      .eq("visit_id", visit!.id)
      .eq("document_type_name", "ID Proof")
      .single();

    expect(idProofRequirement).not.toBeNull();
    expect(
      patientDocs?.some((d) => d.document_type_id === idProofRequirement?.document_type_id),
    ).toBe(true);
  });
});
