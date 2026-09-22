import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getSessionProfile } from "@/lib/auth/session";
import { AuthError } from "@/lib/auth/guards";

interface LogAuditInput {
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Writes an audit_logs row for the CURRENT session. hospital_id and
 * user_id always come from getSessionProfile() — never accept them as
 * parameters, so a caller can't audit-log an action against a
 * hospital other than its own. Inserts via the user's own session
 * client, so the audit_logs RLS policy's WITH CHECK is a second,
 * independent enforcement of the same rule.
 */
export async function logAudit({ action, targetType, targetId, metadata }: LogAuditInput) {
  const profile = await getSessionProfile();
  if (!profile) {
    throw new AuthError("Sign-in required.", 401);
  }

  const supabase = await createClient();
  const { error } = await supabase.from("audit_logs").insert({
    hospital_id: profile.hospitalId,
    user_id: profile.userId,
    action,
    target_type: targetType,
    target_id: targetId ?? null,
    metadata: metadata ?? {},
  });

  if (error) {
    throw error;
  }
}

interface LogAuditAsInput extends LogAuditInput {
  hospitalId: string;
  userId: string;
}

/**
 * Same as logAudit(), for the one caller that has no session to pull
 * hospital_id/user_id from: the Phase 5 phone-camera scan upload
 * (src/app/scan/actions.ts), which authenticates via a validated
 * scan_sessions token instead. hospitalId/userId here come from that
 * already-validated row's own hospital_id/created_by, never from
 * anything the phone itself submits. Inserts via the service-role
 * client (RLS's WITH CHECK can't apply — there's no auth.uid() to
 * check it against), so this is deliberately a narrower exception,
 * not a general-purpose replacement for logAudit().
 */
export async function logAuditFromServiceRole({
  hospitalId,
  userId,
  action,
  targetType,
  targetId,
  metadata,
}: LogAuditAsInput) {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("audit_logs").insert({
    hospital_id: hospitalId,
    user_id: userId,
    action,
    target_type: targetType,
    target_id: targetId ?? null,
    metadata: metadata ?? {},
  });

  if (error) {
    throw error;
  }
}
