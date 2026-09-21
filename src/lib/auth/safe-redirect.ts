/**
 * Only ever redirect to a same-origin, relative path supplied via a
 * `next` query/form param — never follow it to an external host
 * (open-redirect guard).
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return null;
  }
  return next;
}
