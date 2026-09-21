import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database";

// Must match scripts/seed.ts.
export const DEMO_PASSWORD = "demo-password-123!";

export const SEED_ACCOUNTS = {
  platformAdmin: "super@platform.test",
  sunrise: { admin: "admin@sunrise.test", receptionist: "reception@sunrise.test" },
  clarity: { admin: "admin@clarity.test", receptionist: "reception@clarity.test" },
  wellspring: { admin: "admin@wellspring.test", receptionist: "reception@wellspring.test" },
} as const;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Run \`npx supabase start\`, copy its output into ` +
        ".env.local, then `npm run db:seed` before running RLS integration tests.",
    );
  }
  return value;
}

/** Fresh anon-key client — RLS applies exactly as it does for the real app. */
export function anonClient(): SupabaseClient<Database> {
  return createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/** Bypasses RLS. Only for reading ground truth in test setup/assertions, never for the behavior under test. */
export function serviceRoleClient(): SupabaseClient<Database> {
  return createClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function signInAs(email: string): Promise<SupabaseClient<Database>> {
  const client = anonClient();
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: DEMO_PASSWORD,
  });
  if (error || !data.session) {
    throw new Error(
      `Could not sign in as ${email}: ${error?.message ?? "no session"}. Did you run \`npm run db:seed\`?`,
    );
  }
  return client;
}

export async function hospitalIdByName(name: string): Promise<string> {
  const { data, error } = await serviceRoleClient()
    .from("hospitals")
    .select("id")
    .eq("name", name)
    .single();
  if (error || !data) {
    throw new Error(`Seed hospital "${name}" not found. Did you run \`npm run db:seed\`?`);
  }
  return data.id;
}
