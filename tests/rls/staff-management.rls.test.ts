import { describe, expect, it } from "vitest";
import { SEED_ACCOUNTS, serviceRoleClient, signInAs } from "./helpers";

async function profileIdByEmail(email: string): Promise<string> {
  const { data, error } = await serviceRoleClient()
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();
  if (error || !data) throw new Error(`Seed profile "${email}" not found.`);
  return data.id;
}

describe("profiles status-update RLS (Phase 1c staff management)", () => {
  it("a hospital admin can deactivate and reactivate their own hospital's staff", async () => {
    const admin = await signInAs(SEED_ACCOUNTS.sunrise.admin);
    const receptionistId = await profileIdByEmail(SEED_ACCOUNTS.sunrise.receptionist);

    const { data: deactivated, error: deactivateError } = await admin
      .from("profiles")
      .update({ status: "INACTIVE" })
      .eq("id", receptionistId)
      .select("status")
      .single();
    expect(deactivateError).toBeNull();
    expect(deactivated?.status).toBe("INACTIVE");

    const { data: reactivated, error: reactivateError } = await admin
      .from("profiles")
      .update({ status: "ACTIVE" })
      .eq("id", receptionistId)
      .select("status")
      .single();
    expect(reactivateError).toBeNull();
    expect(reactivated?.status).toBe("ACTIVE");
  });

  it("cross-tenant: a hospital admin cannot deactivate another hospital's staff", async () => {
    const sunriseAdmin = await signInAs(SEED_ACCOUNTS.sunrise.admin);
    const clarityAdminId = await profileIdByEmail(SEED_ACCOUNTS.clarity.admin);

    const { data, error } = await sunriseAdmin
      .from("profiles")
      .update({ status: "INACTIVE" })
      .eq("id", clarityAdminId)
      .select();

    expect(error).toBeNull();
    expect(data).toHaveLength(0);

    const { data: actual } = await serviceRoleClient()
      .from("profiles")
      .select("status")
      .eq("id", clarityAdminId)
      .single();
    expect(actual?.status).toBe("ACTIVE");
  });

  it("a receptionist (non-admin) cannot deactivate anyone, including themselves", async () => {
    const receptionist = await signInAs(SEED_ACCOUNTS.sunrise.receptionist);
    const ownId = await profileIdByEmail(SEED_ACCOUNTS.sunrise.receptionist);

    const { data, error } = await receptionist
      .from("profiles")
      .update({ status: "INACTIVE" })
      .eq("id", ownId)
      .select();

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("the status-update grant cannot be used to change role or hospital_id", async () => {
    const admin = await signInAs(SEED_ACCOUNTS.sunrise.admin);
    const receptionistId = await profileIdByEmail(SEED_ACCOUNTS.sunrise.receptionist);
    const clarityId = (
      await serviceRoleClient()
        .from("hospitals")
        .select("id")
        .eq("name", "Clarity Diagnostics")
        .single()
    ).data!.id;

    const { error } = await admin
      .from("profiles")
      .update({ role: "HOSPITAL_ADMIN", hospital_id: clarityId })
      .eq("id", receptionistId);

    // Column-level GRANT only allows updating `status` — any other
    // column in the same UPDATE is rejected outright by Postgres.
    expect(error).not.toBeNull();

    const { data: unchanged } = await serviceRoleClient()
      .from("profiles")
      .select("role, hospital_id")
      .eq("id", receptionistId)
      .single();
    expect(unchanged?.role).toBe("RECEPTIONIST");
  });
});
