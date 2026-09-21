"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Browser-side Supabase client (anon key — safe for the client
 * bundle). Only needed for interactive flows that can't round-trip
 * through a server action, namely MFA enroll/verify (QR code display,
 * live code entry).
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
