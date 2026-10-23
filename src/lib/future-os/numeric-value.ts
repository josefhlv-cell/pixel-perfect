import { parseNumber } from "./adapters/cnb-arad";

/**
 * Evidence `value` is jsonb. Adapters store either a bare number (OECD) or a
 * provenance object whose numeric payload lives at `.value` (ČNB ARAD, BIS, Eurostat).
 * Missing, non-finite and non-numeric payloads are unknown — never coerced to 0.
 */
export function readNumericEvidenceValue(value: unknown, depth = 0): number | null {
  if (depth > 3) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return parseNumber(value);
  if (value && typeof value === "object" && !Array.isArray(value) && "value" in value) {
    return readNumericEvidenceValue((value as { value: unknown }).value, depth + 1);
  }
  return null;
}
