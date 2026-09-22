// No "server-only" here deliberately, same reasoning as
// src/lib/documents/file-validation.ts: this takes an injected client
// rather than constructing one itself, so it has no secret of its own
// to guard and stays directly testable (including the defense-in-
// depth property that RLS still applies if this is ever accidentally
// called with a tenant-scoped client instead of the service-role one).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { hashScanToken } from "@/lib/scan/token";

export type ScanSessionRow = Database["public"]["Tables"]["scan_sessions"]["Row"];

/**
 * The phone's only credential. Resolves a raw token to its
 * scan_sessions row, but only while it's still usable: PENDING and
 * not yet expired. Everything else (COMPLETED, CANCELLED, expired, or
 * simply no matching hash) is treated identically as "not usable" so
 * a caller can't distinguish "wrong token" from "right token, session
 * over" by timing or response shape.
 *
 * Takes an injected client (always the service-role client in
 * practice — see src/lib/supabase/service-role.ts) so this can be
 * exercised directly against a real Postgres instance in tests
 * without going through a Next.js request at all.
 */
export async function resolveScanSession(
  supabase: SupabaseClient<Database>,
  rawToken: string,
): Promise<ScanSessionRow | null> {
  const tokenHash = hashScanToken(rawToken);

  const { data } = await supabase
    .from("scan_sessions")
    .select("*")
    .eq("token_hash", tokenHash)
    .eq("status", "PENDING")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  return data ?? null;
}
