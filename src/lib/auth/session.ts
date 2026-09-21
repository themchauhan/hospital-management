import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { HospitalStatus, StaffRole } from "@/types/database";

export interface SessionProfile {
  userId: string;
  email: string;
  name: string;
  role: StaffRole;
  /** null only for a verified platform admin (see isPlatformAdmin). */
  hospitalId: string | null;
  isPlatformAdmin: boolean;
  hospital: {
    id: string;
    name: string;
    status: HospitalStatus;
    trialEndsAt: string;
    subscriptionEndsAt: string | null;
  } | null;
}

/**
 * The ONLY place `hospital_id` and `role` are read from for
 * authorization purposes, always derived from the authenticated
 * session — never from a client-supplied value. Cached per request so
 * repeated calls in one render pass don't re-query.
 *
 * Returns null if there is no signed-in, active user.
 */
export const getSessionProfile = cache(async (): Promise<SessionProfile | null> => {
  const supabase = await createClient();

  // getUser() revalidates against the Auth server rather than trusting
  // the local cookie's JWT claims — required for a server-side
  // authorization source of truth (getSession() alone is not enough
  // here).
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, hospital_id, name, email, role, status")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.status !== "ACTIVE") {
    return null;
  }

  let isPlatformAdmin = false;
  if (profile.role === "SUPER_ADMIN") {
    const { data: platformAdmin } = await supabase
      .from("platform_admins")
      .select("id")
      .eq("profile_id", user.id)
      .maybeSingle();

    // A SUPER_ADMIN profile with no platform_admins row is a data
    // inconsistency, not a valid platform admin — deny rather than
    // silently downgrade to some other implicit access level.
    if (!platformAdmin) {
      return null;
    }
    isPlatformAdmin = true;
  }

  let hospital: SessionProfile["hospital"] = null;
  if (profile.hospital_id) {
    const { data: hospitalRow } = await supabase
      .from("hospitals")
      .select("id, name, status, trial_ends_at, subscription_ends_at")
      .eq("id", profile.hospital_id)
      .single();

    if (hospitalRow) {
      hospital = {
        id: hospitalRow.id,
        name: hospitalRow.name,
        status: hospitalRow.status,
        trialEndsAt: hospitalRow.trial_ends_at,
        subscriptionEndsAt: hospitalRow.subscription_ends_at,
      };
    }
  }

  return {
    userId: user.id,
    email: profile.email,
    name: profile.name,
    role: profile.role,
    hospitalId: profile.hospital_id,
    isPlatformAdmin,
    hospital,
  };
});
