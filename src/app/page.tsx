export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-4 py-16 sm:px-6">
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
        Hospital &amp; USG Management SaaS
      </p>
      <h1 className="mt-2 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
        Project scaffold is running.
      </h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
        This is the Phase 1a placeholder home page. Authentication, roles, and the patient/visit
        workflows are built out in later phases per{" "}
        <code className="rounded bg-black/[.06] px-1.5 py-0.5 font-mono text-[0.9em] dark:bg-white/[.08]">
          docs/BRIEF.md
        </code>
        .
      </p>
    </main>
  );
}
