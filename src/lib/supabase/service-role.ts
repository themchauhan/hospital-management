import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * The ONE place a service-role Supabase client may be constructed.
 * Bypasses RLS entirely — for provisioning tasks that need the
 * Supabase Admin API (creating/inviting Auth users), which no regular
 * user session can do regardless of role: platform-admin provisioning
 * (seed scripts, scripts/provision-super-admin.ts) and the
 * HOSPITAL_ADMIN staff-invite flow (Phase 1c). Every call site using
 * this client MUST still call requireRole()/requireActiveTenant()
 * first and derive any hospital_id from the caller's own
 * getSessionProfile() result, never from client input — RLS can't
 * backstop that for you here the way it does for a regular session
 * client. Never use this for an ordinary tenant read/write; use
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
