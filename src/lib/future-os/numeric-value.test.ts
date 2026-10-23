import { describe, expect, it } from "vitest";
import { readNumericEvidenceValue } from "./numeric-value";

describe("readNumericEvidenceValue", () => {
  it("reads bare numbers and rejects non-finite values", () => {
    expect(readNumericEvidenceValue(1702875)).toBe(1702875);
    expect(readNumericEvidenceValue(0)).toBe(0);
    expect(readNumericEvidenceValue(-3.75)).toBe(-3.75);
    expect(readNumericEvidenceValue(Number.NaN)).toBeNull();
    expect(readNumericEvidenceValue(Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("unwraps official-source provenance objects without treating them as zero", () => {
    expect(readNumericEvidenceValue({ value: 1702875, raw: "1702875", snapshot_id: null })).toBe(
      1702875,
    );
    expect(readNumericEvidenceValue({ value: 3.75, period: "2025-Q1", geo: "CZ" })).toBe(3.75);
    expect(readNumericEvidenceValue({ value: "1 234,5", raw: "1 234,5" })).toBe(1234.5);
  });

  it("does not invent a number from empty, raw-only or non-numeric payloads", () => {
    expect(readNumericEvidenceValue(null)).toBeNull();
    expect(readNumericEvidenceValue(undefined)).toBeNull();
    expect(readNumericEvidenceValue({})).toBeNull();
    expect(readNumericEvidenceValue({ value: null, raw: "1702875" })).toBeNull();
    expect(readNumericEvidenceValue({ raw: "10" })).toBeNull();
    expect(readNumericEvidenceValue({ value: "" })).toBeNull();
    expect(readNumericEvidenceValue({ value: "n/a" })).toBeNull();
    expect(readNumericEvidenceValue(["1702875"])).toBeNull();
  });
});
