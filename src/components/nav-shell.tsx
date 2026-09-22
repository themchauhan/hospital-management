import Link from "next/link";
import type { StaffRole } from "@/types/database";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/patients", label: "Patients" },
  { href: "/visits", label: "Visits" },
  { href: "/dashboard/usg", label: "USG" },
  { href: "/dashboard/documents", label: "Documents" },
  { href: "/dashboard/settings", label: "Settings" },
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
 * The Visits link is still a placeholder — visits are per-patient
 * only (no top-level /visits list exists yet). Phase 1b added the
 * real sign-in/sign-out control on the right.
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
    <header className="border-b border-slate-200 bg-white print:hidden">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-teal-600 text-xs font-bold text-white">
            +
          </span>
          <span>Hospital &amp; USG Records</span>
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-teal-50 hover:text-teal-800"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        {session ? (
          <div className="flex items-center gap-3">
            <div className="text-right text-xs leading-tight text-slate-500">
              <p className="font-medium text-slate-900">{session.email}</p>
              <p>
                {ROLE_LABELS[session.role]}
                {session.hospitalName ? ` · ${session.hospitalName}` : ""}
              </p>
            </div>
            <form action={onSignOut ?? (() => {})}>
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
              >
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <Link
            href="/login"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
