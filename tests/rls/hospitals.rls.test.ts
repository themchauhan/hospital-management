import { describe, expect, it } from "vitest";
import { SEED_ACCOUNTS, hospitalIdByName, serviceRoleClient, signInAs } from "./helpers";

describe("hospitals RLS", () => {
  it("a receptionist only ever sees their own hospital, regardless of filter", async () => {
    const sunrise = await signInAs(SEED_ACCOUNTS.sunrise.receptionist);

    const { data: allRows, error } = await sunrise.from("hospitals").select("*");
    expect(error).toBeNull();
    expect(allRows).toHaveLength(1);
    expect(allRows?.[0].name).toBe("Sunrise General Hospital");

    const clarityId = await hospitalIdByName("Clarity Diagnostics");
    const { data: forged, error: forgedError } = await sunrise
      .from("hospitals")
      .select("*")
      .eq("id", clarityId);
    expect(forgedError).toBeNull();
    expect(forged).toHaveLength(0);
  });

  it("a platform admin sees every hospital", async () => {
    const platformAdmin = await signInAs(SEED_ACCOUNTS.platformAdmin);
    const { data, error } = await platformAdmin.from("hospitals").select("*");
    expect(error).toBeNull();
    expect((data?.length ?? 0) >= 3).toBe(true);
  });

  it("no authenticated role can update a hospital row (writes are service-role only)", async () => {
    const sunrise = await signInAs(SEED_ACCOUNTS.sunrise.admin);
    const sunriseId = await hospitalIdByName("Sunrise General Hospital");

    const { data: updated, error } = await sunrise
      .from("hospitals")
      .update({ name: "Hacked Name" })
      .eq("id", sunriseId)
      .select();

    // RLS with no UPDATE policy silently matches zero rows rather than
    // erroring — assert nothing came back AND the row is unchanged.
    expect(error).toBeNull();
    expect(updated).toHaveLength(0);

    const { data: actual } = await serviceRoleClient()
      .from("hospitals")
      .select("name")
      .eq("id", sunriseId)
      .single();
    expect(actual?.name).toBe("Sunrise General Hospital");
  });
});
