import { createClient } from "@supabase/supabase-js";

/**
 * Test-only cleanup. Local Supabase data persists across repeated
 * `npm run e2e` runs, so patient fixtures created with a shared name
 * prefix (e.g. "E2E Test Patient <timestamp>") accumulate and become
 * mutually similar enough to trip the fuzzy-duplicate-detector against
 * *each other* across runs — a false "possible duplicate" for a test
 * that expects a clean create. Hard-deletes here (service-role,
 * outside the app) are fine for disposable test fixtures; the app
 * itself never hard-deletes patients (hard rule #6).
 */
export async function cleanupTestPatients(namePrefix: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  await supabase.from("patients").delete().ilike("name", `${namePrefix}%`);
}
