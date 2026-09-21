import "server-only";

import { createClient } from "@/lib/supabase/server";
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
