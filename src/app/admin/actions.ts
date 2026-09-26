"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { logPlatformAdminAudit } from "@/lib/audit/log";
import type { HospitalStatus, ModuleType } from "@/types/database";

export interface CreateHospitalState {
  error?: string;
}

const VALID_MODULES: readonly ModuleType[] = ["GENERAL_OPD", "USG"];

export async function createHospital(
  _prevState: CreateHospitalState,
  formData: FormData,
): Promise<CreateHospitalState> {
  // requireRole(["SUPER_ADMIN"]) alone is sufficient here:
  // getSessionProfile() already returns null for a SUPER_ADMIN profile
  // with no platform_admins row (Phase 1b), so a non-null profile with
  // this role is already a verified platform admin.
  requireRole(await getSessionProfile(), ["SUPER_ADMIN"]);

  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const modules = formData.getAll("modules").map(String) as ModuleType[];
  const adminName = String(formData.get("adminName") ?? "").trim();
  const adminEmail = String(formData.get("adminEmail") ?? "")
    .trim()
    .toLowerCase();

  if (!name) {
    return { error: "Enter a centre name." };
  }
  if (modules.length === 0 || modules.some((m) => !VALID_MODULES.includes(m))) {
    return { error: "Choose at least one module." };
  }
  if (!adminName || !adminEmail) {
    return { error: "Enter the first admin's name and email." };
  }

  const supabase = await createClient();

  const { data: hospital, error: hospitalError } = await supabase
    .from("hospitals")
    .insert({ name, address, phone, email })
    .select("id")
    .single();
  if (hospitalError || !hospital) {
    return { error: "Could not create the centre. Try again." };
  }

  const { error: modulesError } = await supabase
    .from("hospital_modules")
    .insert(modules.map((module) => ({ hospital_id: hospital.id, module })));
  if (modulesError) {
    return { error: "Centre created, but could not enable its modules. Contact support." };
  }

  const serviceRole = createServiceRoleClient();
  const { data: invited, error: inviteError } = await serviceRole.auth.admin.inviteUserByEmail(
    adminEmail,
    { data: { name: adminName } },
  );
  if (inviteError || !invited.user) {
    return {
      error: `Centre created, but could not invite ${adminEmail}: ${inviteError?.message ?? "unknown error"}`,
    };
  }

  const { error: profileError } = await serviceRole.from("profiles").insert({
    id: invited.user.id,
    hospital_id: hospital.id,
    name: adminName,
    email: adminEmail,
    role: "HOSPITAL_ADMIN",
    status: "ACTIVE",
  });
  if (profileError) {
    return { error: "Centre created and admin invited, but could not create their staff record." };
  }

  await logPlatformAdminAudit({
    targetHospitalId: hospital.id,
    action: "hospital.created",
    targetType: "hospital",
    targetId: hospital.id,
    metadata: { modules, adminEmail },
  });

  revalidatePath("/admin");
  redirect(`/admin/hospitals/${hospital.id}`);
}

export async function updateHospitalStatus(
  hospitalId: string,
  status: HospitalStatus,
): Promise<{ error?: string }> {
  requireRole(await getSessionProfile(), ["SUPER_ADMIN"]);

  const supabase = await createClient();
  const { error } = await supabase.from("hospitals").update({ status }).eq("id", hospitalId);
  if (error) {
    return { error: "Could not update that centre's status." };
  }

  await logPlatformAdminAudit({
    targetHospitalId: hospitalId,
    action: "hospital.status_changed",
    targetType: "hospital",
    targetId: hospitalId,
    metadata: { status },
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/hospitals/${hospitalId}`);
  return {};
}

export async function updateHospitalPlan(
  hospitalId: string,
  plan: string,
): Promise<{ error?: string }> {
  requireRole(await getSessionProfile(), ["SUPER_ADMIN"]);

  const trimmed = plan.trim();
  if (!trimmed) {
    return { error: "Enter a plan name." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("hospitals").update({ plan: trimmed }).eq("id", hospitalId);
  if (error) {
    return { error: "Could not update that centre's plan." };
  }

  await logPlatformAdminAudit({
    targetHospitalId: hospitalId,
    action: "hospital.plan_changed",
    targetType: "hospital",
    targetId: hospitalId,
    metadata: { plan: trimmed },
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/hospitals/${hospitalId}`);
  return {};
}

export interface RecordPaymentState {
  error?: string;
}

export async function recordSubscriptionPayment(
  hospitalId: string,
  _prevState: RecordPaymentState,
  formData: FormData,
): Promise<RecordPaymentState> {
  requireRole(await getSessionProfile(), ["SUPER_ADMIN"]);

  const amountRaw = String(formData.get("amount") ?? "").trim();
  const amount = amountRaw ? Number(amountRaw) : NaN;
  const paymentMethod = String(formData.get("paymentMethod") ?? "").trim();
  const referenceNumber = String(formData.get("referenceNumber") ?? "").trim() || null;
  const periodStart = String(formData.get("periodStart") ?? "").trim();
  const periodEnd = String(formData.get("periodEnd") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (Number.isNaN(amount) || amount <= 0) {
    return { error: "Enter a positive amount." };
  }
  if (!paymentMethod) {
    return { error: "Enter a payment method." };
  }
  if (!periodStart || !periodEnd) {
    return { error: "Enter the period this payment covers." };
  }
  if (periodEnd < periodStart) {
    return { error: "Period end must be on or after the period start." };
  }

  const supabase = await createClient();
  const { error: paymentError } = await supabase.from("subscription_payments").insert({
    hospital_id: hospitalId,
    amount,
    payment_method: paymentMethod,
    reference_number: referenceNumber,
    period_start: periodStart,
    period_end: periodEnd,
    notes,
  });
  if (paymentError) {
    return { error: "Could not record the payment." };
  }

  // A recorded payment naturally extends and reactivates the centre —
  // see the Phase 8 plan for why this is bundled into one action
  // rather than two separate steps an admin has to remember.
  const { data: hospital } = await supabase
    .from("hospitals")
    .select("status")
    .eq("id", hospitalId)
    .single();

  const { error: updateError } = await supabase
    .from("hospitals")
    .update({
      subscription_ends_at: periodEnd,
      ...(hospital && hospital.status !== "ACTIVE" ? { status: "ACTIVE" as HospitalStatus } : {}),
    })
    .eq("id", hospitalId);
  if (updateError) {
    return { error: "Payment recorded, but could not extend the subscription." };
  }

  await logPlatformAdminAudit({
    targetHospitalId: hospitalId,
    action: "subscription_payment.recorded",
    targetType: "hospital",
    targetId: hospitalId,
    metadata: { amount, paymentMethod, periodStart, periodEnd },
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/hospitals/${hospitalId}`);
  return {};
}
