import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { StaffRole } from "@/types/database";

const MFA_REQUIRED_ROLES: readonly StaffRole[] = ["SUPER_ADMIN", "HOSPITAL_ADMIN"];

export type MfaStatus = "not_required" | "enroll_required" | "challenge_required" | "satisfied";

/**
 * Per Phase 1c: MFA is required for SUPER_ADMIN and HOSPITAL_ADMIN,
 * not RECEPTIONIST. "Required" means enforced on next login — a role
 * that requires it but hasn't enrolled a factor yet must do so before
 * reaching any protected page; one that has must complete a challenge
 * each session before reaching aal2.
 */
export async function getMfaStatus(role: StaffRole): Promise<MfaStatus> {
  if (!MFA_REQUIRED_ROLES.includes(role)) {
    return "not_required";
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) {
    return "not_required";
  }

  if (data.currentLevel === "aal2") {
    return "satisfied";
  }
  if (data.nextLevel === "aal2") {
    // A verified factor exists; this session just hasn't completed
    // the challenge yet.
    return "challenge_required";
  }
  return "enroll_required";
}
