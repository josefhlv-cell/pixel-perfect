import { describe, expect, it } from "vitest";
import { sourceVintagesVisibleAt, toSourceVintageInserts, type SourceVintage } from "./source-vintages";
import type { EvidenceObservation } from "./types";

const base: SourceVintage = {
  sourceKey: "eurostat",
  seriesKey: "house-price-index",
  geographyKey: "CZ",
  periodKey: "2025-Q1",
  sourcePublishedAt: null,
  retrievedAt: "2025-06-01T00:00:00.000Z",
  sourceRevision: null,
  numericValue: 120,
  unit: "index",
  payloadHash: "a".repeat(64),
  quality: "RETRIEVAL_SNAPSHOT",
};

describe("point-in-time source vintage reconstruction", () => {
  it("never leaks a snapshot retrieved after the as-of time", () => {
    const future = { ...base, retrievedAt: "2025-07-01T00:00:00.000Z", numericValue: 125, payloadHash: "b".repeat(64) };
    expect(sourceVintagesVisibleAt([base, future], "2025-06-15T00:00:00.000Z").map(row => row.numericValue)).toEqual([120]);
  });

  it("uses the latest retrieved snapshot per source-series-geography-period", () => {
    const later = { ...base, retrievedAt: "2025-06-10T00:00:00.000Z", numericValue: 121, payloadHash: "b".repeat(64) };
    expect(sourceVintagesVisibleAt([base, later], "2025-06-15T00:00:00.000Z")).toHaveLength(1);
    expect(sourceVintagesVisibleAt([base, later], "2025-06-15T00:00:00.000Z")[0].numericValue).toBe(121);
  });

  it("filters to a requested geography", () => {
    const other = { ...base, geographyKey: "PL", payloadHash: "b".repeat(64) };
    expect(sourceVintagesVisibleAt([base, other], "2025-06-15T00:00:00.000Z", { geographyKey: "CZ" }).map(row => row.geographyKey)).toEqual(["CZ"]);
  });

  it("rejects fabricated observed-vintage labels without source metadata", () => {
    const mislabeled = { ...base, quality: "OBSERVED_VINTAGE" as const };
    expect(() => sourceVintagesVisibleAt([mislabeled], "2025-06-15T00:00:00.000Z")).toThrow(/publication time and revision/);
  });
});

describe("Eurostat retrieval snapshot mapping", () => {
  const observation = (overrides: Partial<EvidenceObservation> = {}) => ({
    id: "eurostat:CZ:2025-Q1",
    sourceId: "eurostat-prc-hpi-q",
    sourceName: "Eurostat prc_hpi_q",
    sourceType: "official_statistical",
    sourceUrl: "https://ec.europa.eu/eurostat/api",
    publisher: "Eurostat",
    geographyType: "country",
    geographyKey: "CZ",
    entityType: "series",
    entityKey: "house_price_index_total_2015",
    observedAt: "2025-01-01T00:00:00.000Z",
    publishedAt: null,
    retrievedAt: "2026-10-10T10:00:00.000Z",
    availableAt: "2026-10-10T10:00:00.000Z",
    effectiveFrom: "2025-01-01T00:00:00.000Z",
    effectiveTo: null,
    revision: 1,
    value: { value: 125.5, period: "2025-Q1", geo: "CZ" },
    unit: "index_2015_100",
    frequency: "quarterly",
    leadClass: "LAGGING",
    sourceReliability: 0.97,
    independenceGroup: "eurostat",
    contentHash: "source-hash",
    isRevision: false,
    supersedesId: null,
    metadata: { eurostatDatasetUpdatedAt: "2026-09-20" },
    createdAt: "2026-10-10T10:00:00.000Z",
    ...overrides,
  }) as EvidenceObservation;

  it("maps live values to stable retrieval snapshots, never observed vintages", () => {
    const row = observation();
    const first = toSourceVintageInserts([row]);
    const second = toSourceVintageInserts([row]);
    expect(first).toHaveLength(1);
    expect(first[0]?.quality).toBe("RETRIEVAL_SNAPSHOT");
    expect(first[0]?.payload_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(first[0]?.payload_hash).toBe(second[0]?.payload_hash);
    expect(first[0]?.source_published_at).toBeNull();
  });

  it("ignores malformed periods and non-finite values", () => {
    expect(toSourceVintageInserts([
      observation({ value: { value: 100, period: "not-a-quarter" } }),
      observation({ value: { value: Number.NaN, period: "2025-Q1" } }),
    ])).toEqual([]);
  });
});
