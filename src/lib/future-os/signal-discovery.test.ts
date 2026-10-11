import { describe, expect, it } from "vitest";
import {
  discoverLeadingSignals,
  evaluateLeadingSignal,
  parseEvidenceNumericValue,
} from "./signal-discovery";

function series(offset = 0) {
  return Array.from({ length: 24 }, (_, i) => ({
    date: new Date(Date.UTC(2020 + Math.floor(i / 12), i % 12, 1)).toISOString(),
    value: Math.sin(i / 3) + offset,
  }));
}

describe("Future OS leading-signal discovery", () => {
  it("normalizes numeric evidence values from importer JSON shapes", () => {
    expect(parseEvidenceNumericValue(12.5)).toBe(12.5);
    expect(parseEvidenceNumericValue(" 12.5 ")).toBe(12.5);
    expect(parseEvidenceNumericValue("12,5")).toBe(12.5);
    expect(parseEvidenceNumericValue({ value: 12.5, raw: "12.5" })).toBe(12.5);
    expect(parseEvidenceNumericValue({ value: null, raw: "12.5" })).toBe(12.5);
    expect(parseEvidenceNumericValue({ value: "not-a-number", raw: "12.5" })).toBe(12.5);
    expect(parseEvidenceNumericValue({ value: null, raw: null })).toBeNull();
    expect(parseEvidenceNumericValue("")).toBeNull();
    expect(parseEvidenceNumericValue(true)).toBeNull();
    expect(parseEvidenceNumericValue(Number.NaN)).toBeNull();
    expect(parseEvidenceNumericValue("1 234,5")).toBe(1234.5);
    expect(parseEvidenceNumericValue("1\u00A0234,5")).toBe(1234.5);
    expect(parseEvidenceNumericValue("1\u202F234,50")).toBe(1234.5);
    expect(parseEvidenceNumericValue("1.234,5")).toBe(1234.5);
    expect(parseEvidenceNumericValue("-1 234,5")).toBe(-1234.5);
    expect(parseEvidenceNumericValue("1.234")).toBe(1.234);
    expect(parseEvidenceNumericValue({ value: null, raw: "1 234,5" })).toBe(1234.5);
    expect(parseEvidenceNumericValue("1 234,5 EUR")).toBeNull();
    expect(parseEvidenceNumericValue("   ")).toBeNull();
  });

  it("rejects undersampled relationships", () => {
    const result = evaluateLeadingSignal({
      signal: series().slice(0, 5),
      target: series().slice(0, 5),
      lagDays: 30,
      windowDays: 365,
    });
    expect(result.status).toBe("REJECTED");
    expect(result.leadScore).toBeNull();
  });

  it("recognizes a stable lagged relationship", () => {
    const signal = series();
    const target = signal.map((point, i) => ({
      ...point,
      date: new Date(new Date(point.date).getTime() + 180 * 86_400_000).toISOString(),
      value: point.value * 2,
    }));
    const result = evaluateLeadingSignal({
      signal,
      target,
      lagDays: 180,
      windowDays: 365,
      minSamples: 10,
    });
    expect(result.sampleCount).toBeGreaterThanOrEqual(10);
    expect(result.correlation ?? 0).toBeGreaterThan(0.9);
    expect(result.stability ?? 0).toBeGreaterThan(0.5);
  });

  it("searches multiple candidate entities and lags", () => {
    const observations = [
      ...series().map((x, i) => ({
        id: `s-${i}`,
        sourceId: "test",
        sourceName: "test",
        sourceType: "test",
        sourceUrl: null,
        publisher: "test",
        geographyType: "city",
        geographyKey: "PRG",
        entityType: "series",
        entityKey: "signal_a",
        observedAt: x.date,
        publishedAt: x.date,
        retrievedAt: x.date,
        availableAt: x.date,
        effectiveFrom: x.date,
        effectiveTo: null,
        revision: 1,
        value: x.value,
        unit: "x",
        frequency: "monthly",
        leadClass: "LEADING" as const,
        sourceReliability: 1,
        independenceGroup: "test",
        contentHash: `h-${i}`,
        isRevision: false,
        supersedesId: null,
        metadata: {},
        createdAt: x.date,
      })),
      ...series(1).map((x, i) => ({
        id: `t-${i}`,
        sourceId: "test",
        sourceName: "test",
        sourceType: "test",
        sourceUrl: null,
        publisher: "test",
        geographyType: "city",
        geographyKey: "PRG",
        entityType: "series",
        entityKey: "target",
        observedAt: x.date,
        publishedAt: x.date,
        retrievedAt: x.date,
        availableAt: x.date,
        effectiveFrom: x.date,
        effectiveTo: null,
        revision: 1,
        value: x.value,
        unit: "x",
        frequency: "monthly",
        leadClass: "LAGGING" as const,
        sourceReliability: 1,
        independenceGroup: "test",
        contentHash: `t-${i}`,
        isRevision: false,
        supersedesId: null,
        metadata: {},
        createdAt: x.date,
      })),
    ];
    const results = discoverLeadingSignals(observations, "series:target", [30, 90]);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.signalKey).toBe("series:signal_a");
  });

  it("discovers a lead from Czech grouped numbers stored only as raw text", () => {
    const observations = Array.from({ length: 16 }, (_, i) => {
      const date = new Date(Date.UTC(2021, i, 1)).toISOString();
      const base = {
        sourceId: "cnb",
        sourceName: "ČNB",
        sourceType: "official_statistical",
        sourceUrl: null,
        publisher: "ČNB",
        geographyType: "country",
        geographyKey: "CZ",
        observedAt: date,
        publishedAt: date,
        retrievedAt: date,
        availableAt: date,
        effectiveFrom: date,
        effectiveTo: null,
        revision: 1,
        unit: "index",
        frequency: "monthly",
        sourceReliability: 0.9,
        independenceGroup: "cnb",
        isRevision: false,
        supersedesId: null,
        metadata: {},
        createdAt: date,
      };
      const level = 1000 + i * 10;
      return [
        {
          ...base,
          id: `rate-${i}`,
          entityType: "macro_indicator",
          entityKey: "rate",
          leadClass: "LEADING" as const,
          contentHash: `rate-${i}`,
          value: { value: null, raw: `${level.toLocaleString("cs-CZ")}` },
        },
        {
          ...base,
          id: `hpi-${i}`,
          entityType: "macro_indicator",
          entityKey: "hpi",
          leadClass: "LAGGING" as const,
          contentHash: `hpi-${i}`,
          observedAt: new Date(Date.UTC(2021, i, 1) + 90 * 86_400_000).toISOString(),
          effectiveFrom: new Date(Date.UTC(2021, i, 1) + 90 * 86_400_000).toISOString(),
          value: { value: null, raw: (level * 2).toLocaleString("cs-CZ") },
        },
      ];
    }).flat();

    const results = discoverLeadingSignals(observations, "macro_indicator:hpi", [90]);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.signalKey).toBe("macro_indicator:rate");
    expect(results[0]?.status).not.toBe("REJECTED");
  });
});
