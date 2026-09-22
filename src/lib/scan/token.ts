// No "server-only" here deliberately: pure node:crypto logic with no
// secrets and no Next-specific APIs (same reasoning as
// src/lib/documents/file-validation.ts), so it stays unit-testable.

import { randomBytes, createHash } from "node:crypto";

/**
 * The QR/link's only credential. 32 random bytes (256 bits) is far
 * beyond brute-forceable within the token's own short expiry window.
 */
export function generateScanToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Only this hash is ever stored — the raw token lives solely in the
 * QR image and the phone's URL fragment, never in a database row or a
 * server log.
 */
export function hashScanToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
