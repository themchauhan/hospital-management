/**
 * One-time, manually-run provisioning for the first SUPER_ADMIN(s).
 * There is deliberately no public signup route or in-app UI for this
 * — per docs/phases/phase-1c.md, creating a platform admin is always
 * a service-role, operator-run action.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/provision-super-admin.ts \
 *     --email you@example.com --name "Jane Doe"
 *
 * Sends a Supabase invite email (the same token_hash link flow as
 * supabase/templates/invite.html) so the operator sets their own
 * password — this script never generates or prints one.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}

function readArg(name: string): string | undefined {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

const email = readArg("email");
const name = readArg("name");

if (!email || !name) {
  console.error("Usage: provision-super-admin.ts --email <email> --name <name>");
  process.exit(1);
}

const supabase = createClient<Database>(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { count } = await supabase
    .from("platform_admins")
    .select("id", { count: "exact", head: true });
  if (count && count > 0) {
    console.log(`Note: ${count} platform admin(s) already exist. Adding another.\n`);
  }

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email!, {
    data: { name },
  });
  if (error || !data.user) {
    throw error ?? new Error("inviteUserByEmail returned no user");
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: data.user.id,
    hospital_id: null,
    name: name!,
    email: email!,
    role: "SUPER_ADMIN",
    status: "ACTIVE",
  });
  if (profileError) throw profileError;

  const { error: platformAdminError } = await supabase
    .from("platform_admins")
    .insert({ profile_id: data.user.id });
  if (platformAdminError) throw platformAdminError;

  console.log(`Invited ${email} as SUPER_ADMIN. They'll receive an email to set their password.`);
  console.log(
    "Locally (no SMTP configured), check http://127.0.0.1:54324 (Inbucket/Mailpit) for the email.",
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nProvisioning failed:", error);
    process.exit(1);
  });
