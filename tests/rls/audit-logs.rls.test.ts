import { describe, expect, it } from "vitest";
import { SEED_ACCOUNTS, hospitalIdByName, serviceRoleClient, signInAs } from "./helpers";

describe("audit_logs RLS", () => {
  it("can insert an audit log row scoped to the caller's own hospital", async () => {
    const sunrise = await signInAs(SEED_ACCOUNTS.sunrise.receptionist);
    const hospitalId = await hospitalIdByName("Sunrise General Hospital");

    const { data, error } = await sunrise
      .from("audit_logs")
      .insert({
        hospital_id: hospitalId,
        action: "test.event",
        target_type: "test",
      })
      .select();

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("rejects an insert with a forged hospital_id belonging to another hospital", async () => {
    const sunrise = await signInAs(SEED_ACCOUNTS.sunrise.receptionist);
    const clarityId = await hospitalIdByName("Clarity Diagnostics");

    const { error } = await sunrise.from("audit_logs").insert({
      hospital_id: clarityId,
      action: "test.forged",
      target_type: "test",
    });

    expect(error).not.toBeNull();
  });

  it("rejects an insert with a forged user_id impersonating someone else", async () => {
    const sunrise = await signInAs(SEED_ACCOUNTS.sunrise.receptionist);
    const hospitalId = await hospitalIdByName("Sunrise General Hospital");
    // profiles RLS deliberately hides the admin's row from a
    // receptionist (see profiles.rls.test.ts), so ground truth for
    // the forged id has to come from the service-role client, not the
    // restricted session under test.
    const { data: otherProfile } = await serviceRoleClient()
      .from("profiles")
      .select("id")
      .eq("email", SEED_ACCOUNTS.sunrise.admin)
      .single();

    const { error } = await sunrise.from("audit_logs").insert({
      hospital_id: hospitalId,
      user_id: otherProfile!.id,
      action: "test.impersonation",
      target_type: "test",
    });

    expect(error).not.toBeNull();
  });

  it("only shows the caller's own hospital's audit rows", async () => {
    const sunrise = await signInAs(SEED_ACCOUNTS.sunrise.admin);
    const sunriseId = await hospitalIdByName("Sunrise General Hospital");

    const { data, error } = await sunrise.from("audit_logs").select("hospital_id");
    expect(error).toBeNull();
    for (const row of data ?? []) {
      expect(row.hospital_id).toBe(sunriseId);
    }
  });

  it("cannot update or delete an existing audit log row (append-only)", async () => {
    const sunrise = await signInAs(SEED_ACCOUNTS.sunrise.receptionist);
    const hospitalId = await hospitalIdByName("Sunrise General Hospital");

    const { data: inserted } = await sunrise
      .from("audit_logs")
      .insert({ hospital_id: hospitalId, action: "test.immutable", target_type: "test" })
      .select()
      .single();
    expect(inserted).toBeTruthy();

    const { data: updated } = await sunrise
      .from("audit_logs")
      .update({ action: "tampered" })
      .eq("id", inserted!.id)
      .select();
    expect(updated).toHaveLength(0);

    const { data: deleted } = await sunrise
      .from("audit_logs")
      .delete()
      .eq("id", inserted!.id)
      .select();
    expect(deleted).toHaveLength(0);
  });
});
