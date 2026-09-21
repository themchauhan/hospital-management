import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * The user's own Supabase session client. Every tenant read/write goes
 * through this (never the service-role client), so RLS applies. Create
 * a fresh one per request — never module-level singletons.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component that can't set cookies
            // (no response to attach them to). Harmless as long as
            // middleware.ts is also refreshing the session, which it
            // is — see middleware.ts.
          }
        },
      },
    },
  );
}
