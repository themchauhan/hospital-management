"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionProfile } from "@/lib/auth/session";
import { requireRole, requireActiveTenant, AuthError } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit/log";
import type { PaymentMode } from "@/types/database";

export interface CreateVisitState {
  error?: string;
}

export async function createVisit(
  patientId: string,
  _prevState: CreateVisitState,
  formData: FormData,
): Promise<CreateVisitState> {
  requireActiveTenant(requireRole(await getSessionProfile(), ["HOSPITAL_ADMIN", "RECEPTIONIST"]));

  const visitTypeId = String(formData.get("visitTypeId") ?? "").trim();
  if (!visitTypeId) {
    return { error: "Choose a visit type." };
  }
  const doctorId = String(formData.get("doctorId") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const feeAmountRaw = String(formData.get("feeAmount") ?? "").trim();
  const feeAmount = feeAmountRaw ? Number(feeAmountRaw) : 0;
  const followUpDate = String(formData.get("followUpDate") ?? "").trim() || null;

  if (Number.isNaN(feeAmount) || feeAmount < 0) {
    return { error: "Fee must be a positive number." };
  }

  const supabase = await createClient();
  const { data: visit, error } = await supabase
    .from("visits")
    .insert({
      patient_id: patientId,
      visit_type_id: visitTypeId,
      doctor_id: doctorId,
      notes,
      fee_amount: feeAmount,
      follow_up_date: followUpDate,
    })
    .select("id")
    .single();

  if (error || !visit) {
    return { error: "Could not create the visit. Try again." };
  }

  await logAudit({ action: "visit.created", targetType: "visit", targetId: visit.id });

  redirect(`/dashboard/visits/${visit.id}`);
}

export interface RecordPaymentState {
  error?: string;
}

export async function recordPayment(
  visitId: string,
  _prevState: RecordPaymentState,
  formData: FormData,
): Promise<RecordPaymentState> {
  const profile = requireActiveTenant(
    requireRole(await getSessionProfile(), ["HOSPITAL_ADMIN", "RECEPTIONIST"]),
  );

  const isReversal = formData.get("isReversal") === "true";
  if (isReversal && profile.role !== "HOSPITAL_ADMIN") {
    throw new AuthError("Only an admin can record a reversal.", 403);
  }

  const amountRaw = String(formData.get("amount") ?? "").trim();
  const amount = amountRaw ? Number(amountRaw) : NaN;
  const mode = String(formData.get("mode") ?? "").trim() as PaymentMode;
  const note = String(formData.get("note") ?? "").trim() || null;

  if (Number.isNaN(amount) || amount === 0) {
    return { error: "Enter a non-zero amount." };
  }
  if (!(["CASH", "UPI", "CARD", "OTHER"] as const).includes(mode)) {
    return { error: "Choose a payment mode." };
  }
  if (isReversal && amount > 0) {
    return { error: "A reversal amount must be negative." };
  }
  if (!isReversal && amount < 0) {
    return { error: "Amount must be positive." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("visit_payments").insert({
    visit_id: visitId,
    amount,
    mode,
    note,
    is_reversal: isReversal,
  });

  if (error) {
    return { error: "Could not record the payment. Try again." };
  }

  await logAudit({
    action: isReversal ? "payment.reversed" : "payment.recorded",
    targetType: "visit",
    targetId: visitId,
    metadata: { amount, mode },
  });

  revalidatePath(`/dashboard/visits/${visitId}`);
  return {};
}
