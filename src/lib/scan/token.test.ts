import { describe, expect, it } from "vitest";
import { generateScanToken, hashScanToken } from "./token";

describe("generateScanToken", () => {
  it("generates a long, URL-safe token", () => {
    const token = generateScanToken();
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("never repeats across calls", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => generateScanToken()));
    expect(tokens.size).toBe(100);
  });
});

describe("hashScanToken", () => {
  it("is deterministic", () => {
    const token = generateScanToken();
    expect(hashScanToken(token)).toBe(hashScanToken(token));
  });

  it("produces different hashes for different tokens", () => {
    expect(hashScanToken(generateScanToken())).not.toBe(hashScanToken(generateScanToken()));
  });

  it("returns a sha256 hex digest", () => {
    expect(hashScanToken("anything")).toMatch(/^[0-9a-f]{64}$/);
  });
});
