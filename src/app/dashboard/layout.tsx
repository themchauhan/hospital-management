import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/guards";
import { getMfaStatus } from "@/lib/auth/mfa";

/**
 * Shared by every /dashboard/* route: tenant-role gate + MFA gate, so
 * a new nested page under /dashboard can't accidentally ship without
 * either check (unlike per-page inline checks, which are easy to
 * forget to copy). /dashboard/staff still adds its own narrower
 * HOSPITAL_ADMIN-only check on top of this.
 */
export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const profile = await getSessionProfile();

  if (!profile) {
    redirect("/login?next=/dashboard");
  }
  if (profile.isPlatformAdmin) {
    redirect("/admin");
  }
  requireRole(profile, ["HOSPITAL_ADMIN", "RECEPTIONIST"]);

  const mfaStatus = await getMfaStatus(profile.role);
  if (mfaStatus === "enroll_required") {
    redirect("/mfa/setup?next=/dashboard");
  }
  if (mfaStatus === "challenge_required") {
    redirect("/mfa/verify?next=/dashboard");
  }

  return children;
}
