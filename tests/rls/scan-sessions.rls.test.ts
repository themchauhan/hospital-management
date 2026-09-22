import { describe, expect, it } from "vitest";
import { SEED_ACCOUNTS, hospitalIdByName, signInAs, serviceRoleClient } from "./helpers";
import { resolveScanSession } from "../../src/lib/scan/resolve-session";
import { generateScanToken, hashScanToken } from "../../src/lib/scan/token";

async function insertScanSession(
  staffEmail: string,
  hospitalName: string,
  overrides: { expiresAt?: Date; status?: "PENDING" | "COMPLETED" | "CANCELLED" } = {},
) {
  // Patients (and their patient_code) must be created through an
  // authenticated session, same as documents.rls.test.ts's fixtures —
  // next_patient_code() derives hospital_id from auth.uid() and
  // raises under a service-role caller, which has none.
  const authed = await signInAs(staffEmail);
  const service = serviceRoleClient();
  const hospitalId = await hospitalIdByName(hospitalName);

  const { data: patient, error: patientError } = await authed
    .from("patients")
    .insert({ name: "Scan Session Test Patient" })
    .select()
    .single();
  if (patientError || !patient) throw patientError ?? new Error("failed to create patient");

  const { data: documentType, error: typeError } = await service
    .from("document_types")
    .select("id")
    .eq("hospital_id", hospitalId)
    .eq("name", "ID Proof")
    .single();
  if (typeError || !documentType) throw typeError ?? new Error("ID Proof document type not found");

  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("id")
    .eq("email", staffEmail)
    .single();
  if (profileError || !profile) throw profileError ?? new Error("staff profile not found");

  const rawToken = generateScanToken();
  const { data: session, error } = await service
    .from("scan_sessions")
    .insert({
      hospital_id: hospitalId,
      created_by: profile.id,
      patient_id: patient.id,
      document_type_id: documentType.id,
      token_hash: hashScanToken(rawToken),
      status: overrides.status ?? "PENDING",
      expires_at: (overrides.expiresAt ?? new Date(Date.now() + 10 * 60 * 1000)).toISOString(),
    })
    .select()
    .single();
  if (error || !session) throw error ?? new Error("failed to create scan session");

  return { rawToken, session, hospitalId, patientId: patient.id };
}

describe("scan_sessions RLS + resolveScanSession", () => {
  it("resolves a valid, unexpired, PENDING token", async () => {
    const { rawToken, session } = await insertScanSession(
      SEED_ACCOUNTS.sunrise.receptionist,
      "Sunrise General Hospital",
    );
    const resolved = await resolveScanSession(serviceRoleClient(), rawToken);
    expect(resolved?.id).toBe(session.id);
  });

  it("does not resolve once expired", async () => {
    const { rawToken } = await insertScanSession(
      SEED_ACCOUNTS.sunrise.receptionist,
      "Sunrise General Hospital",
      { expiresAt: new Date(Date.now() - 60 * 1000) },
    );
    const resolved = await resolveScanSession(serviceRoleClient(), rawToken);
    expect(resolved).toBeNull();
  });

  it("does not resolve once COMPLETED", async () => {
    const { rawToken } = await insertScanSession(
      SEED_ACCOUNTS.sunrise.receptionist,
      "Sunrise General Hospital",
      { status: "COMPLETED" },
    );
    const resolved = await resolveScanSession(serviceRoleClient(), rawToken);
    expect(resolved).toBeNull();
  });

  it("does not resolve once CANCELLED", async () => {
    const { rawToken } = await insertScanSession(
      SEED_ACCOUNTS.sunrise.receptionist,
      "Sunrise General Hospital",
      { status: "CANCELLED" },
    );
    const resolved = await resolveScanSession(serviceRoleClient(), rawToken);
    expect(resolved).toBeNull();
  });

  it("cross-tenant: another hospital's staff cannot SELECT the row directly", async () => {
    const { session } = await insertScanSession(
      SEED_ACCOUNTS.sunrise.receptionist,
      "Sunrise General Hospital",
    );
    const clarity = await signInAs(SEED_ACCOUNTS.clarity.admin);
    const { data } = await clarity.from("scan_sessions").select("*").eq("id", session.id);
    expect(data).toHaveLength(0);
  });

  it("defense in depth: resolveScanSession returns null if ever called with a different hospital's session client, even with the correct token", async () => {
    const { rawToken } = await insertScanSession(
      SEED_ACCOUNTS.sunrise.receptionist,
      "Sunrise General Hospital",
    );
    const clarity = await signInAs(SEED_ACCOUNTS.clarity.admin);
    // RLS still filters this out even though the token itself is
    // correct -- resolveScanSession is meant to be called with the
    // service-role client (the phone has no session of its own), but
    // this proves a mistaken call with a tenant-scoped client fails
    // closed rather than leaking across hospitals.
    const resolved = await resolveScanSession(clarity, rawToken);
    expect(resolved).toBeNull();
  });

  it("resolves normally when called with the *same* hospital's own session client", async () => {
    const { rawToken } = await insertScanSession(
      SEED_ACCOUNTS.sunrise.receptionist,
      "Sunrise General Hospital",
    );
    const sunrise = await signInAs(SEED_ACCOUNTS.sunrise.receptionist);
    const resolved = await resolveScanSession(sunrise, rawToken);
    expect(resolved).not.toBeNull();
  });

  it("a leaked token never resolves to another hospital's data no matter which hospital's row is looked up", async () => {
    const sunrise = await insertScanSession(
      SEED_ACCOUNTS.sunrise.receptionist,
      "Sunrise General Hospital",
    );
    const clarity = await insertScanSession(SEED_ACCOUNTS.clarity.admin, "Clarity Diagnostics");
    expect(sunrise.session.hospital_id).not.toBe(clarity.session.hospital_id);

    const resolvedForSunriseToken = await resolveScanSession(serviceRoleClient(), sunrise.rawToken);
    const resolvedForClarityToken = await resolveScanSession(serviceRoleClient(), clarity.rawToken);
    expect(resolvedForSunriseToken?.hospital_id).toBe(sunrise.hospitalId);
    expect(resolvedForSunriseToken?.patient_id).toBe(sunrise.patientId);
    expect(resolvedForClarityToken?.hospital_id).toBe(clarity.hospitalId);
    expect(resolvedForClarityToken?.patient_id).toBe(clarity.patientId);
  });
});
