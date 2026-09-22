import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * The ONE place a service-role Supabase client may be constructed.
 * Bypasses RLS entirely. Two legitimate shapes of caller:
 *
 * 1. An authenticated staff action that needs the Supabase Admin API
 *    (creating/inviting Auth users), which no regular user session
 *    can do regardless of role: platform-admin provisioning (seed
 *    scripts, scripts/provision-super-admin.ts) and the
 *    HOSPITAL_ADMIN staff-invite flow (Phase 1c). These MUST still
 *    call requireRole()/requireActiveTenant() first and derive any
 *    hospital_id from the caller's own getSessionProfile() result,
 *    never from client input — RLS can't backstop that here the way
 *    it does for a regular session client.
 *
 * 2. A token-authenticated action with no user session at all: the
 *    Phase 5 phone-camera scan upload (src/app/scan/actions.ts). The
 *    phone never signs in, so there is no getSessionProfile() to call
 *    — instead, hospital_id/patient_id/visit_id/document_type_id are
 *    derived from a previously validated `scan_sessions` row
 *    (resolveScanSession(), keyed on the token's hash), itself only
 *    ever created earlier through shape (1) by an authenticated
 *    receptionist/admin. The token is the only credential; treat it
 *    with the same care as a password-reset token.
 *
 * Never use this for an ordinary tenant read/write; use
 * `src/lib/supabase/server.ts`'s `createClient()` instead so RLS
 * applies. Do not import this module from anything reachable by a
 * client component.
 */
export function createServiceRoleClient() {
  if (typeof window !== "undefined") {
    throw new Error(
      "createServiceRoleClient() was called in a browser context. The " +
        "service-role key must never be reachable from client code.",
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both " +
        "be set to use the service-role client.",
    );
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
