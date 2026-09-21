/**
 * Dev-only seed script. Never run against a production project, and
 * never put real patient/staff data here (hard rule #5).
 *
 * Run after `supabase start` (or `supabase db reset`):
 *   npm run db:seed
 *
 * Deliberately NOT reused: src/lib/supabase/service-role.ts. That
 * module imports the "server-only" package, whose guard is only
 * meaningful (and only resolves correctly) inside Next.js's own
 * build/runtime. This script runs as a plain Node process via tsx, so
 * it constructs its own service-role client directly instead.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database, ModuleType } from "../src/types/database";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in " +
      ".env.local (run `npx supabase status` after `supabase start` for local values).",
  );
  process.exit(1);
}

const supabase = createClient<Database>(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Obviously-fake, dev-only credential. Never used for anything but
// local/demo Supabase projects.
const DUMMY_PASSWORD = "demo-password-123!";

interface HospitalSeed {
  name: string;
  address: string;
  phone: string;
  email: string;
  modules: ModuleType[];
  admin: { name: string; email: string };
  receptionist: { name: string; email: string };
}

const PLATFORM_ADMIN = { name: "Demo Platform Admin", email: "super@platform.test" };

const HOSPITALS: HospitalSeed[] = [
  {
    name: "Sunrise General Hospital",
    address: "12 MG Road, Demo City",
    phone: "+91 90000 00001",
    email: "contact@sunrise.test",
    modules: ["GENERAL_OPD"],
    admin: { name: "Demo Admin (Sunrise)", email: "admin@sunrise.test" },
    receptionist: { name: "Demo Receptionist (Sunrise)", email: "reception@sunrise.test" },
  },
  {
    name: "Clarity Diagnostics",
    address: "45 Station Road, Demo City",
    phone: "+91 90000 00002",
    email: "contact@clarity.test",
    modules: ["USG"],
    admin: { name: "Demo Admin (Clarity)", email: "admin@clarity.test" },
    receptionist: { name: "Demo Receptionist (Clarity)", email: "reception@clarity.test" },
  },
  {
    name: "Wellspring Multispecialty",
    address: "8 Civil Lines, Demo City",
    phone: "+91 90000 00003",
    email: "contact@wellspring.test",
    modules: ["GENERAL_OPD", "USG"],
    admin: { name: "Demo Admin (Wellspring)", email: "admin@wellspring.test" },
    receptionist: { name: "Demo Receptionist (Wellspring)", email: "reception@wellspring.test" },
  },
];

async function createAuthUser(email: string, name: string) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: DUMMY_PASSWORD,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error || !data.user) {
    throw error ?? new Error(`Failed to create auth user ${email}`);
  }
  return data.user;
}

async function main() {
  console.log("Seeding dummy data (no real patient or staff information)...\n");

  const superUser = await createAuthUser(PLATFORM_ADMIN.email, PLATFORM_ADMIN.name);
  const { error: superProfileError } = await supabase.from("profiles").insert({
    id: superUser.id,
    hospital_id: null,
    name: PLATFORM_ADMIN.name,
    email: PLATFORM_ADMIN.email,
    role: "SUPER_ADMIN",
    status: "ACTIVE",
  });
  if (superProfileError) throw superProfileError;

  const { error: platformAdminError } = await supabase
    .from("platform_admins")
    .insert({ profile_id: superUser.id });
  if (platformAdminError) throw platformAdminError;

  console.log(`Platform admin : ${PLATFORM_ADMIN.email}`);

  for (const hospitalSeed of HOSPITALS) {
    const { data: hospital, error: hospitalError } = await supabase
      .from("hospitals")
      .insert({
        name: hospitalSeed.name,
        address: hospitalSeed.address,
        phone: hospitalSeed.phone,
        email: hospitalSeed.email,
        status: "ACTIVE",
      })
      .select()
      .single();
    if (hospitalError || !hospital) {
      throw hospitalError ?? new Error(`Failed to insert hospital ${hospitalSeed.name}`);
    }

    const { error: modulesError } = await supabase
      .from("hospital_modules")
      .insert(hospitalSeed.modules.map((module) => ({ hospital_id: hospital.id, module })));
    if (modulesError) throw modulesError;

    const adminUser = await createAuthUser(hospitalSeed.admin.email, hospitalSeed.admin.name);
    const { error: adminProfileError } = await supabase.from("profiles").insert({
      id: adminUser.id,
      hospital_id: hospital.id,
      name: hospitalSeed.admin.name,
      email: hospitalSeed.admin.email,
      role: "HOSPITAL_ADMIN",
      status: "ACTIVE",
    });
    if (adminProfileError) throw adminProfileError;

    const receptionistUser = await createAuthUser(
      hospitalSeed.receptionist.email,
      hospitalSeed.receptionist.name,
    );
    const { error: receptionistProfileError } = await supabase.from("profiles").insert({
      id: receptionistUser.id,
      hospital_id: hospital.id,
      name: hospitalSeed.receptionist.name,
      email: hospitalSeed.receptionist.email,
      role: "RECEPTIONIST",
      status: "ACTIVE",
    });
    if (receptionistProfileError) throw receptionistProfileError;

    if (hospitalSeed.name === "Sunrise General Hospital") {
      // A pre-deactivated account, for exercising the "deactivated
      // staff cannot log in" path (Phase 1c) without needing a live
      // admin session to deactivate one first.
      const deactivatedUser = await createAuthUser(
        "deactivated@sunrise.test",
        "Demo Deactivated (Sunrise)",
      );
      const { error: deactivatedProfileError } = await supabase.from("profiles").insert({
        id: deactivatedUser.id,
        hospital_id: hospital.id,
        name: "Demo Deactivated (Sunrise)",
        email: "deactivated@sunrise.test",
        role: "RECEPTIONIST",
        status: "INACTIVE",
      });
      if (deactivatedProfileError) throw deactivatedProfileError;
    }

    console.log(
      `${hospitalSeed.name.padEnd(15)}: admin=${hospitalSeed.admin.email}  receptionist=${hospitalSeed.receptionist.email}`,
    );
  }

  console.log(`\nAll seeded accounts share the password: ${DUMMY_PASSWORD}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nSeed failed:", error);
    console.error(
      "\nIf this is a duplicate-key error, the seed has probably already run — " +
        "`npx supabase db reset` for a clean slate before re-seeding.",
    );
    process.exit(1);
  });
