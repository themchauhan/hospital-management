"use server";

import QRCode from "qrcode";
import { getSessionProfile } from "@/lib/auth/session";
import { requireRole, requireActiveTenant } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { generateScanToken, hashScanToken } from "@/lib/scan/token";

export interface CreateScanSessionResult {
  sessionId: string;
  qrDataUrl: string;
  scanUrl: string;
}

export async function createScanSession(input: {
  patientId: string;
  visitId?: string;
  documentTypeId: string;
}): Promise<CreateScanSessionResult | { error: string }> {
  const profile = requireActiveTenant(
    requireRole(await getSessionProfile(), ["HOSPITAL_ADMIN", "RECEPTIONIST"]),
  );

  const supabase = await createClient();

  // Best-effort rate limiting: only one live QR per staff member at a
  // time. A double-click race leaving two PENDING rows briefly is a
  // UX nit, not a security issue — each row is independently valid,
  // expiring, and single-use regardless.
  await supabase
    .from("scan_sessions")
    .update({ status: "CANCELLED" })
    .eq("created_by", profile.userId)
    .eq("status", "PENDING");

  const rawToken = generateScanToken();
  const tokenHash = hashScanToken(rawToken);

  const { data: created, error } = await supabase
    .from("scan_sessions")
    .insert({
      patient_id: input.patientId,
      visit_id: input.visitId ?? null,
      document_type_id: input.documentTypeId,
      token_hash: tokenHash,
    })
    .select("id")
    .single();

  if (error || !created) {
    return { error: "Could not start a scan session. Try again." };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const scanUrl = `${appUrl}/scan#${rawToken}`;
  const qrDataUrl = await QRCode.toDataURL(scanUrl);

  return { sessionId: created.id, qrDataUrl, scanUrl };
}

export interface ScanSessionStatusResult {
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  pageCount: number;
}

export async function getScanSessionStatus(
  sessionId: string,
): Promise<ScanSessionStatusResult | { error: string }> {
  requireActiveTenant(requireRole(await getSessionProfile(), ["HOSPITAL_ADMIN", "RECEPTIONIST"]));

  const supabase = await createClient();
  const { data: session } = await supabase
    .from("scan_sessions")
    .select("status")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) {
    return { error: "Session not found." };
  }

  const { count } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("scan_session_id", sessionId)
    .is("deleted_at", null);

  return { status: session.status, pageCount: count ?? 0 };
}
