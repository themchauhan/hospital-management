import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * The ONE place a service-role Supabase client may be constructed.
 * Bypasses RLS entirely — for platform-admin provisioning tasks only
 * (seed scripts, hospital/staff provisioning in Phase 1c). Never use
 * this for a regular tenant read/write; use
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
