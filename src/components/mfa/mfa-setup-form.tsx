"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function MfaSetupForm({ next }: { next: string }) {
  const router = useRouter();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function start() {
      // Clear out any abandoned unverified factor(s) from a previous
      // attempt first — enroll() can't re-display a secret once
      // issued, so a stale factor would leave the QR/secret shown
      // here out of sync with what's actually pending server-side.
      // (`.totp` on the list response is typed as verified-only, so
      // unverified factors are found via `.all` instead.) This also
      // guards against a duplicate-friendly-name enroll() failure if
      // a previous attempt's cleanup didn't complete.
      const { data: existing } = await supabase.auth.mfa.listFactors();
      const staleFactors =
        existing?.all.filter((f) => f.factor_type === "totp" && f.status === "unverified") ?? [];
      for (const stale of staleFactors) {
        await supabase.auth.mfa.unenroll({ factorId: stale.id });
      }
      if (cancelled) return;

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        // No friendlyName: letting Supabase assign one avoids a
        // "factor with this friendly name already exists" enroll
        // failure if cleanup above raced with another attempt (e.g.
        // React Strict Mode's double effect invocation in dev).
      });
      if (cancelled) return;
      if (enrollError || !data) {
        setError(enrollError?.message ?? "Could not start MFA setup.");
        return;
      }
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
    }

    start();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setVerifying(true);
    setError(null);

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });

    if (verifyError) {
      setError("Incorrect code. Check your authenticator app and try again.");
      setVerifying(false);
      return;
    }

    router.push(next);
    router.refresh();
  }

  if (error && !factorId) {
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        {error}
      </p>
    );
  }

  if (!qrCode || !secret) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">Setting up…</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- qrCode is
          a data: URI returned per-request from Supabase Auth, not a
          static asset next/image can optimize. */}
      <img
        src={qrCode}
        alt="QR code to scan with your authenticator app"
        width={200}
        height={200}
        className="w-fit rounded-md bg-white p-2"
      />
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Scan with your authenticator app, or enter this code manually:{" "}
        <code className="rounded bg-black/[.06] px-1.5 py-0.5 font-mono dark:bg-white/[.08]">
          {secret}
        </code>
      </p>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="code" className="text-sm font-medium">
          6-digit code
        </label>
        <input
          id="code"
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-950 dark:border-zinc-700 dark:focus:border-zinc-50"
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={verifying || code.length !== 6}
        className="w-full rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
      >
        {verifying ? "Verifying…" : "Confirm"}
      </button>
    </form>
  );
}
