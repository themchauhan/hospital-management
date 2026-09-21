import { createClient } from "@supabase/supabase-js";

/**
 * Test-only cleanup: several specs need to exercise the MFA *enroll*
 * flow specifically, which only happens on an account's first login.
 * Local Supabase data persists across repeated `npm run e2e` runs, so
 * without this, a second run would find the account already enrolled
 * from the previous run and land on /mfa/verify instead — call this
 * before such a test to guarantee a clean slate regardless of run
 * history. Never used by application code; only Playwright tests run
 * this, entirely outside the Next.js app.
 */
export async function resetMfaFactors(email: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError) throw usersError;
  const user = users.users.find((u) => u.email === email);
  if (!user) throw new Error(`No auth user found for ${email}`);

  const { data: factorsData, error: factorsError } = await supabase.auth.admin.mfa.listFactors({
    userId: user.id,
  });
  if (factorsError) throw factorsError;

  for (const factor of factorsData.factors) {
    await supabase.auth.admin.mfa.deleteFactor({ id: factor.id, userId: user.id });
  }
}
