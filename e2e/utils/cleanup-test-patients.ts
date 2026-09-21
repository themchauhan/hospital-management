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
 *
 * Cascades through visit_payments -> visits -> patients: the
 * patients<-visits FK is ON DELETE RESTRICT (Phase 3), so deleting a
 * patient that already has visits attached (from a spec that creates
 * both, e.g. visits.spec.ts) would otherwise fail outright.
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

  const { data: patients } = await supabase
    .from("patients")
    .select("id")
    .ilike("name", `${namePrefix}%`);
  const patientIds = (patients ?? []).map((p) => p.id);
  if (patientIds.length === 0) return;

  const { data: visits } = await supabase.from("visits").select("id").in("patient_id", patientIds);
  const visitIds = (visits ?? []).map((v) => v.id);

  // documents.patient_id/visit_id are both ON DELETE RESTRICT, so any
  // document (patient- or visit-level) attached to these fixtures must
  // go first — storage objects too, since nothing else will clean
  // those up.
  const { data: documents } = await supabase
    .from("documents")
    .select("id, storage_path")
    .in("patient_id", patientIds);
  if (documents && documents.length > 0) {
    await supabase.storage.from("documents").remove(documents.map((d) => d.storage_path));
    await supabase
      .from("documents")
      .delete()
      .in(
        "id",
        documents.map((d) => d.id),
      );
  }

  if (visitIds.length > 0) {
    await supabase.from("visit_payments").delete().in("visit_id", visitIds);
    await supabase.from("visits").delete().in("id", visitIds);
  }

  await supabase.from("patients").delete().in("id", patientIds);
}
