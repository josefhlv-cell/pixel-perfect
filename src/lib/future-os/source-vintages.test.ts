import { describe, expect, it } from "vitest";
import { sourceVintagesVisibleAt, type SourceVintage } from "./source-vintages";

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
