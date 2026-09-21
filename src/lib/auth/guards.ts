import type { SessionProfile } from "@/lib/auth/session";
import type { StaffRole } from "@/types/database";

// No "server-only" import here deliberately: this module is pure
// logic over a SessionProfile value with no cookies/secrets/Node
// APIs, so it's safe to unit test directly. The actual
// session-derivation code that DOES need the guard lives in
// session.ts, supabase/server.ts, and supabase/service-role.ts.

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Throws if there is no signed-in profile, or the profile's role isn't
 * one of `roles`. Every protected server action/route handler should
 * open with:
 *
 *   const profile = await getSessionProfile();
 *   requireRole(profile, ["HOSPITAL_ADMIN", "RECEPTIONIST"]);
 */
export function requireRole(
  profile: SessionProfile | null,
  roles: readonly StaffRole[],
): SessionProfile {
  if (!profile) {
    throw new AuthError("Sign-in required.", 401);
  }
  if (!roles.includes(profile.role)) {
    throw new AuthError("You don't have permission to do that.", 403);
  }
  return profile;
}

/**
 * Throws if the profile's hospital is SUSPENDED or EXPIRED. Platform
 * admins (no hospital) are exempt. Full expiry-driven UX lands in
 * Phase 8; this guard exists now so every later phase's writes are
 * already covered by it.
 */
export function requireActiveTenant(profile: SessionProfile): SessionProfile {
  if (profile.isPlatformAdmin) {
    return profile;
  }
  const status = profile.hospital?.status;
  if (status === "SUSPENDED" || status === "EXPIRED") {
    throw new AuthError(
      "This centre's subscription is not active. Contact your administrator.",
      403,
    );
  }
  return profile;
}
