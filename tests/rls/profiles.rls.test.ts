import { describe, expect, it } from "vitest";
import { SEED_ACCOUNTS, hospitalIdByName, signInAs } from "./helpers";

describe("profiles RLS", () => {
  it("a hospital admin sees only their own hospital's staff", async () => {
    const admin = await signInAs(SEED_ACCOUNTS.sunrise.admin);
    const { data, error } = await admin.from("profiles").select("email, hospital_id");
    expect(error).toBeNull();
    expect(data).not.toHaveLength(0);
    for (const row of data ?? []) {
      expect(row.hospital_id).toBe(await hospitalIdByName("Sunrise General Hospital"));
    }
    // Not an exact-membership check: seed.ts adds accounts over time
    // (e.g. the deactivated demo user in Phase 1c), and this test only
    // needs to prove the known accounts are visible and nothing from
    // another hospital leaks in (checked above via hospital_id).
    const emails = (data ?? []).map((row) => row.email);
    expect(emails).toEqual(
      expect.arrayContaining([SEED_ACCOUNTS.sunrise.admin, SEED_ACCOUNTS.sunrise.receptionist]),
    );
  });

  it("a receptionist (non-admin) sees only their own profile row", async () => {
    const receptionist = await signInAs(SEED_ACCOUNTS.sunrise.receptionist);
    const { data, error } = await receptionist.from("profiles").select("email");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0].email).toBe(SEED_ACCOUNTS.sunrise.receptionist);
  });

  it("cross-tenant: a hospital admin cannot see another hospital's staff by id", async () => {
    const sunriseAdmin = await signInAs(SEED_ACCOUNTS.sunrise.admin);
    const { data: clarityStaff } = await sunriseAdmin
      .from("profiles")
      .select("id")
      .eq("email", SEED_ACCOUNTS.clarity.admin);
    expect(clarityStaff).toHaveLength(0);
  });

  it("cannot insert a profile as an authenticated tenant user", async () => {
    const admin = await signInAs(SEED_ACCOUNTS.sunrise.admin);
    const hospitalId = await hospitalIdByName("Sunrise General Hospital");
    const { error } = await admin.from("profiles").insert({
      id: "00000000-0000-0000-0000-000000000000",
      hospital_id: hospitalId,
      name: "Forged Profile",
      email: "forged@sunrise.test",
      role: "RECEPTIONIST",
    });
    expect(error).not.toBeNull();
  });
});

describe("platform_admins RLS", () => {
  it("a non-platform-admin sees no rows", async () => {
    const admin = await signInAs(SEED_ACCOUNTS.sunrise.admin);
    const { data, error } = await admin.from("platform_admins").select("*");
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("a platform admin sees exactly their own membership row", async () => {
    const platformAdmin = await signInAs(SEED_ACCOUNTS.platformAdmin);
    const { data, error } = await platformAdmin.from("platform_admins").select("*");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
});
