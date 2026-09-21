"use server";

import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth/session";
import { requireRole, requireActiveTenant, AuthError } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logAudit } from "@/lib/audit/log";
import type { StaffRole } from "@/types/database";

export interface InviteStaffState {
  error?: string;
  success?: string;
}

const INVITABLE_ROLES: readonly StaffRole[] = ["HOSPITAL_ADMIN", "RECEPTIONIST"];

export async function inviteStaff(
  _prevState: InviteStaffState,
  formData: FormData,
): Promise<InviteStaffState> {
  const profile = requireActiveTenant(requireRole(await getSessionProfile(), ["HOSPITAL_ADMIN"]));

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "") as StaffRole;

  if (!email || !name) {
    return { error: "Enter a name and email." };
  }
  if (!INVITABLE_ROLES.includes(role)) {
    return { error: "Choose a valid role." };
  }

  // hospital_id always comes from the inviting admin's own session,
  // never from the form — there is no hospital_id field in it.
  const hospitalId = profile.hospitalId!;

  const serviceRole = createServiceRoleClient();
  const { data: invited, error: inviteError } = await serviceRole.auth.admin.inviteUserByEmail(
    email,
    { data: { name } },
  );
  if (inviteError || !invited.user) {
    return { error: `Could not invite that email: ${inviteError?.message ?? "unknown error"}` };
  }

  const { error: profileError } = await serviceRole.from("profiles").insert({
    id: invited.user.id,
    hospital_id: hospitalId,
    name,
    email,
    role,
    status: "ACTIVE",
  });
  if (profileError) {
    return { error: "Invited the email but could not create their staff record. Contact support." };
  }

  await logAudit({
    action: "staff.invited",
    targetType: "profile",
    targetId: invited.user.id,
    metadata: { email, role },
  });

  revalidatePath("/dashboard/staff");
  return { success: `Invited ${email}.` };
}

export async function setStaffStatus(profileId: string, nextStatus: "ACTIVE" | "INACTIVE") {
  const profile = requireActiveTenant(requireRole(await getSessionProfile(), ["HOSPITAL_ADMIN"]));

  if (profileId === profile.userId) {
    throw new AuthError("You can't deactivate your own account.", 403);
  }

  const supabase = await createClient();
  const { error, data } = await supabase
    .from("profiles")
    .update({ status: nextStatus })
    .eq("id", profileId)
    .select("id")
    .single();

  if (error || !data) {
    // RLS silently matches zero rows for a cross-tenant or SUPER_ADMIN
    // target rather than erroring — treat that the same as a real error.
    throw new AuthError("Could not update that staff member.", 403);
  }

  await logAudit({
    action: nextStatus === "ACTIVE" ? "staff.activated" : "staff.deactivated",
    targetType: "profile",
    targetId: profileId,
  });

  revalidatePath("/dashboard/staff");
}
