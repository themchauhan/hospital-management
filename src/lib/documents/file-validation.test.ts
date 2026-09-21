import { describe, expect, it } from "vitest";
import { detectFileType, validateFile, MAX_FILE_SIZE_BYTES } from "./file-validation";

describe("detectFileType", () => {
  it("detects JPEG from magic bytes regardless of surrounding content", () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(detectFileType(buffer)).toEqual({ mime: "image/jpeg", ext: "jpg" });
  });

  it("detects PNG from magic bytes", () => {
    const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    expect(detectFileType(buffer)).toEqual({ mime: "image/png", ext: "png" });
  });

  it("detects PDF from magic bytes", () => {
    const buffer = Buffer.from("%PDF-1.4\n...");
    expect(detectFileType(buffer)).toEqual({ mime: "application/pdf", ext: "pdf" });
  });

  it("returns null for an unrecognized format even with a misleading extension", () => {
    // A plain text file renamed to look like an image — extension
    // alone must never be trusted (the whole point of magic-byte
    // sniffing).
    const buffer = Buffer.from("just some text content", "utf8");
    expect(detectFileType(buffer)).toBeNull();
  });

  it("returns null for an empty buffer", () => {
    expect(detectFileType(Buffer.alloc(0))).toBeNull();
  });
});

describe("validateFile", () => {
  it("accepts a valid JPEG", () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const result = validateFile(buffer);
    expect("error" in result).toBe(false);
  });

  it("rejects an empty file", () => {
    const result = validateFile(Buffer.alloc(0));
    expect(result).toEqual({ error: "The file is empty." });
  });

  it("rejects a file over the size limit", () => {
    const oversized = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff]),
      Buffer.alloc(MAX_FILE_SIZE_BYTES),
    ]);
    const result = validateFile(oversized);
    expect("error" in result).toBe(true);
  });

  it("rejects a disallowed file type with a clear error", () => {
    const result = validateFile(Buffer.from("not a real file"));
    expect(result).toEqual({ error: "Only JPEG, PNG, or PDF files are accepted." });
  });
});
