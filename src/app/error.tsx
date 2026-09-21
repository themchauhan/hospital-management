"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error digest only — never log request bodies here, since
    // patient/document data may pass through server actions on this tree.
    console.error("Unhandled route error", { digest: error.digest });
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <p className="text-sm font-medium text-red-600 dark:text-red-400">Something went wrong</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">An unexpected error occurred</h1>
      <p className="mt-4 max-w-md text-base leading-7 text-zinc-600 dark:text-zinc-400">
        Try again, or come back later if the problem continues.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
      >
        Try again
      </button>
    </main>
  );
}
