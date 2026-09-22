"use client";

import { useState } from "react";
import { getDocumentViewUrl } from "@/app/dashboard/documents/actions";

export function ViewDocumentButton({ documentId }: { documentId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    // Open the tab synchronously, within the click's own event
    // handler, before any await — otherwise the browser can treat the
    // later window.open() as an unrequested popup and block it, since
    // the "this came from a real click" gesture doesn't survive an
    // async gap. A named target (rather than holding onto the
    // returned WindowProxy) is what lets us redirect this same tab
    // once the signed URL is ready: `noopener` on this first call
    // makes window.open() return null in Chromium, so a reference-
    // based approach silently loses the tab and leaves it stuck on
    // about:blank forever.
    const targetName = `document-view-${documentId}`;
    window.open("", targetName);

    setLoading(true);
    setError(null);
    const result = await getDocumentViewUrl(documentId);
    setLoading(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }
    // Safe to add noopener/noreferrer now — the destination is our
    // own signed Supabase Storage URL, not third-party content, and
    // this call doesn't need a reference back.
    window.open(result.url, targetName, "noopener,noreferrer");
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="text-sm text-teal-700 underline hover:text-teal-800 disabled:opacity-60"
      >
        {loading ? "Opening…" : "View"}
      </button>
      {error ? (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      ) : null}
    </span>
  );
}
