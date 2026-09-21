import Link from "next/link";
import type { StaffRole } from "@/types/database";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/patients", label: "Patients" },
  { href: "/visits", label: "Visits" },
  { href: "/documents", label: "Documents" },
  { href: "/settings", label: "Settings" },
] as const;

const ROLE_LABELS: Record<StaffRole, string> = {
  SUPER_ADMIN: "Platform admin",
  HOSPITAL_ADMIN: "Admin",
  RECEPTIONIST: "Receptionist",
};

export interface NavShellSession {
  email: string;
  role: StaffRole;
  hospitalName: string | null;
}

/**
 * The Patients/Visits/Documents/Settings links are still placeholders
 * — those routes don't exist until later phases. Phase 1b only adds
 * the real sign-in/sign-out control on the right.
 *
 * `onSignOut` is passed in (rather than importing the `signOut`
 * server action directly here) so this component stays a plain,
 * dependency-free presentational component that unit tests can render
 * without pulling in server-only/Next-request-context code.
 */
export function NavShell({
  session,
  onSignOut,
}: {
  session?: NavShellSession | null;
  onSignOut?: () => void | Promise<void>;
}) {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Hospital &amp; USG Records
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        {session ? (
          <div className="flex items-center gap-3">
            <div className="text-right text-xs leading-tight text-zinc-500 dark:text-zinc-400">
              <p className="font-medium text-zinc-950 dark:text-zinc-50">{session.email}</p>
              <p>
                {ROLE_LABELS[session.role]}
                {session.hospitalName ? ` · ${session.hospitalName}` : ""}
              </p>
            </div>
            <form action={onSignOut ?? (() => {})}>
              <button
                type="submit"
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <Link
            href="/login"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
