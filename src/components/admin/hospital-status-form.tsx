"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateHospitalStatus } from "@/app/admin/actions";
import type { HospitalStatus } from "@/types/database";

const STATUS_OPTIONS: HospitalStatus[] = ["TRIAL", "ACTIVE", "SUSPENDED", "EXPIRED"];

export function HospitalStatusForm({
  hospitalId,
  currentStatus,
}: {
  hospitalId: string;
  currentStatus: HospitalStatus;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // The displayed value is always derived straight from the
  // server-provided `currentStatus` prop, never held in local state —
  // recordSubscriptionPayment (on this same page) can flip a
  // hospital's status server-side, and a bare useState here wouldn't
  // pick that up after revalidatePath, since React doesn't reset an
  // already-mounted component's own state just because its parent
  // re-rendered with new data.
  function handleChange(next: HospitalStatus) {
    setError(null);
    startTransition(async () => {
      const result = await updateHospitalStatus(hospitalId, next);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-3">
      <select
        value={currentStatus}
        disabled={pending}
        onChange={(e) => handleChange(e.target.value as HospitalStatus)}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600 disabled:opacity-60"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {pending ? <span className="text-sm text-slate-500">Saving…</span> : null}
      {error ? (
        <span role="alert" className="text-sm text-red-600">
          {error}
        </span>
      ) : null}
    </div>
  );
}
