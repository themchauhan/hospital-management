import { describe, expect, it } from "vitest";
import { SEED_ACCOUNTS, hospitalIdByName, signInAs, serviceRoleClient } from "./helpers";

describe("super admin (hospitals / hospital_modules / subscription_payments) RLS", () => {
  it("a HOSPITAL_ADMIN cannot create a new centre", async () => {
    const admin = await signInAs(SEED_ACCOUNTS.sunrise.admin);
    const { data, error } = await admin.from("hospitals").insert({ name: "Rogue Centre" }).select();
    expect(data ?? []).toHaveLength(0);
    expect(error).not.toBeNull();
  });

  it("a HOSPITAL_ADMIN cannot update any hospital's status, including their own", async () => {
    const admin = await signInAs(SEED_ACCOUNTS.sunrise.admin);
    const sunriseId = await hospitalIdByName("Sunrise General Hospital");

    const { data, error } = await admin
      .from("hospitals")
      .update({ status: "SUSPENDED" })
      .eq("id", sunriseId)
      .select();
    expect(data ?? []).toHaveLength(0);
    expect(error).toBeNull(); // RLS silently matches zero rows on UPDATE.

    const { data: unchanged } = await serviceRoleClient()
      .from("hospitals")
      .select("status")
      .eq("id", sunriseId)
      .single();
    expect(unchanged?.status).not.toBe("SUSPENDED");
  });

  it("a HOSPITAL_ADMIN cannot enable a module for a hospital that isn't their own", async () => {
    const admin = await signInAs(SEED_ACCOUNTS.sunrise.admin);
    const clarityId = await hospitalIdByName("Clarity Diagnostics");

    const { data, error } = await admin
      .from("hospital_modules")
      .insert({ hospital_id: clarityId, module: "GENERAL_OPD" })
      .select();
    expect(data ?? []).toHaveLength(0);
    expect(error).not.toBeNull();
  });

  it("a HOSPITAL_ADMIN cannot record a subscription payment", async () => {
    const admin = await signInAs(SEED_ACCOUNTS.sunrise.admin);
    const sunriseId = await hospitalIdByName("Sunrise General Hospital");

    const { data, error } = await admin
      .from("subscription_payments")
      .insert({
        hospital_id: sunriseId,
        amount: 5000,
        payment_method: "UPI",
        period_start: "2026-01-01",
        period_end: "2026-02-01",
      })
      .select();
    expect(data ?? []).toHaveLength(0);
    expect(error).not.toBeNull();
  });

  it("a SUPER_ADMIN can create a centre, enable modules, and record a payment", async () => {
    const platformAdmin = await signInAs(SEED_ACCOUNTS.platformAdmin);

    const centreName = `RLS Test Centre ${Date.now()}`;
    const { data: hospital, error: hospitalError } = await platformAdmin
      .from("hospitals")
      .insert({ name: centreName })
      .select()
      .single();
    expect(hospitalError).toBeNull();
    expect(hospital).not.toBeNull();

    const { error: moduleError } = await platformAdmin
      .from("hospital_modules")
      .insert({ hospital_id: hospital!.id, module: "GENERAL_OPD" });
    expect(moduleError).toBeNull();

    const { error: statusError } = await platformAdmin
      .from("hospitals")
      .update({ status: "ACTIVE" })
      .eq("id", hospital!.id);
    expect(statusError).toBeNull();

    const { error: paymentError } = await platformAdmin.from("subscription_payments").insert({
      hospital_id: hospital!.id,
      amount: 5000,
      payment_method: "UPI",
      period_start: "2026-01-01",
      period_end: "2026-02-01",
    });
    expect(paymentError).toBeNull();

    const { data: confirmed } = await serviceRoleClient()
      .from("hospitals")
      .select("status")
      .eq("id", hospital!.id)
      .single();
    expect(confirmed?.status).toBe("ACTIVE");
  });

  it("a hospital can see its own audit log entries authored by a platform admin, but not another hospital's", async () => {
    const platformAdmin = await signInAs(SEED_ACCOUNTS.platformAdmin);
    const sunriseId = await hospitalIdByName("Sunrise General Hospital");

    const { error: auditError } = await platformAdmin.from("audit_logs").insert({
      hospital_id: sunriseId,
      action: "hospital.status_changed",
      target_type: "hospital",
      target_id: sunriseId,
      metadata: { status: "ACTIVE", test: true },
    });
    expect(auditError).toBeNull();

    const sunriseAdmin = await signInAs(SEED_ACCOUNTS.sunrise.admin);
    const { data: ownEntries } = await sunriseAdmin
      .from("audit_logs")
      .select("*")
      .eq("hospital_id", sunriseId)
      .eq("action", "hospital.status_changed");
    expect((ownEntries ?? []).length).toBeGreaterThan(0);

    const clarityAdmin = await signInAs(SEED_ACCOUNTS.clarity.admin);
    const { data: crossTenant } = await clarityAdmin
      .from("audit_logs")
      .select("*")
      .eq("hospital_id", sunriseId);
    expect(crossTenant ?? []).toHaveLength(0);
  });
});
