import { describe, expect, it } from "vitest";
import { evidenceContentHash } from "./evidence-hash.server";
import { assertNoFutureEvidence, computeDataQuality, getEvidenceAvailableAt } from "./point-in-time";
import type { EvidenceObservation } from "./types";

const base = (overrides: Partial<EvidenceObservation> = {}): EvidenceObservation => ({
  id: "1",
  sourceId: "oecd",
  sourceName: "OECD",
  sourceType: "official_statistical",
  sourceUrl: null,
  publisher: "OECD",
  geographyType: "country",
  geographyKey: "CZ",
  entityType: "series",
  entityKey: "house_price",
  observedAt: "2026-01-01T00:00:00Z",
  publishedAt: "2026-02-15T00:00:00Z",
  retrievedAt: "2026-02-15T01:00:00Z",
  availableAt: "2026-02-15T01:00:00Z",
  effectiveFrom: "2026-01-01T00:00:00Z",
  effectiveTo: null,
  revision: 1,
  value: 100,
  unit: "index",
  frequency: "quarterly",
  leadClass: "LAGGING",
  sourceReliability: 0.95,
  independenceGroup: "oecd",
  contentHash: "hash-1",
  isRevision: false,
  supersedesId: null,
  metadata: {},
  createdAt: "2026-02-15T01:00:00Z",
  ...overrides,
});

describe("Future OS point-in-time integrity", () => {
  it("excludes evidence that was not available at cutoff", () => {
    const rows = [
      base({ id: "past", availableAt: "2026-02-01T00:00:00Z" }),
      base({ id: "future", availableAt: "2026-03-01T00:00:00Z" }),
    ];
    expect(getEvidenceAvailableAt(rows, "2026-02-15T00:00:00Z")).toHaveLength(1);
  });

  it("never silently accepts future evidence", () => {
    expect(() => assertNoFutureEvidence(
      [base({ availableAt: "2026-03-01T00:00:00Z" })],
      "2026-02-15T00:00:00Z",
    )).toThrow(/Point-in-time violation/);
  });

  it("uses information availability rather than event time", () => {
    const row = base({
      observedAt: "2025-01-01T00:00:00Z",
      availableAt: "2026-02-01T00:00:00Z",
    });
    expect(getEvidenceAvailableAt([row], "2026-01-31T23:59:59Z")).toHaveLength(0);
  });

  it("keeps the latest revision known by the cutoff", () => {
    const original = base({ id: "r1", revision: 1, availableAt: "2026-02-01T00:00:00Z", value: 100 });
    const revision = base({ id: "r2", revision: 2, availableAt: "2026-03-01T00:00:00Z", value: 110, isRevision: true, supersedesId: "r1" });
    expect(getEvidenceAvailableAt([original, revision], "2026-02-15T00:00:00Z")[0]?.value).toBe(100);
    expect(getEvidenceAvailableAt([original, revision], "2026-03-15T00:00:00Z")[0]?.value).toBe(110);
  });

  it("produces deterministic content hashes independent of object key order", () => {
    const a = base({ value: { price: 100, rent: 20 } });
    const b = base({ value: { rent: 20, price: 100 } });
    expect(evidenceContentHash(a)).toBe(evidenceContentHash(b));
  });

  it("marks missing evidence as data-starved rather than inventing confidence", () => {
    const q = computeDataQuality([], ["price", "rent", "rates"]);
    expect(q.status).toBe("DATA_STARVED");
    expect(q.completeness).toBe(0);
    expect(q.sourceReliability).toBe(0);
  });

  it("does not treat copied sources as independent evidence", () => {
    const rows = [
      base({ id: "a", independenceGroup: "wire-a" }),
      base({ id: "b", independenceGroup: "wire-a" }),
      base({ id: "c", independenceGroup: "official-b" }),
    ];
    const q = computeDataQuality(rows);
    expect(q.independence).toBeLessThan(1);
  });
});
