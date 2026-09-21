import type { PaymentStatus } from "@/types/database";

/**
 * UNPAID/PARTIAL/PAID is explicitly "derived from the sum of payments
 * vs. fee_amount, not stored directly" per the brief. Deliberately
 * computed here (from a plain RLS-scoped query's results) rather than
 * a database view — see the migration's comment on why a view is the
 * wrong tool for this.
 */
export function derivePaymentStatus(feeAmount: number, amountPaid: number): PaymentStatus {
  if (amountPaid <= 0) return "UNPAID";
  if (amountPaid >= feeAmount) return "PAID";
  return "PARTIAL";
}

export function sumPayments(payments: { amount: number }[]): number {
  return payments.reduce((sum, p) => sum + Number(p.amount), 0);
}
