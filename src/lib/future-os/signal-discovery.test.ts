import { describe, expect, it } from "vitest";
import { discoverLeadingSignals, evaluateLeadingSignal } from "./signal-discovery";

function series(offset = 0) {
  return Array.from({ length: 24 }, (_, i) => ({
    date: new Date(Date.UTC(2020 + Math.floor(i / 12), (i % 12), 1)).toISOString(),
    value: Math.sin(i / 3) + offset,
  }));
}

describe("Future OS leading-signal discovery", () => {
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
    const result = evaluateLeadingSignal({ signal, target, lagDays: 180, windowDays: 365, minSamples: 10 });
    expect(result.sampleCount).toBeGreaterThanOrEqual(10);
    expect(result.correlation ?? 0).toBeGreaterThan(0.9);
    expect(result.stability ?? 0).toBeGreaterThan(0.5);
  });

  it("searches multiple candidate entities and lags", () => {
    const observations = [
      ...series().map((x, i) => ({ id: `s-${i}`, sourceId: "test", sourceName: "test", sourceType: "test", sourceUrl: null, publisher: "test", geographyType: "city", geographyKey: "PRG", entityType: "series", entityKey: "signal_a", observedAt: x.date, publishedAt: x.date, retrievedAt: x.date, availableAt: x.date, effectiveFrom: x.date, effectiveTo: null, revision: 1, value: x.value, unit: "x", frequency: "monthly", leadClass: "LEADING" as const, sourceReliability: 1, independenceGroup: "test", contentHash: `h-${i}`, isRevision: false, supersedesId: null, metadata: {}, createdAt: x.date })),
      ...series(1).map((x, i) => ({ id: `t-${i}`, sourceId: "test", sourceName: "test", sourceType: "test", sourceUrl: null, publisher: "test", geographyType: "city", geographyKey: "PRG", entityType: "series", entityKey: "target", observedAt: x.date, publishedAt: x.date, retrievedAt: x.date, availableAt: x.date, effectiveFrom: x.date, effectiveTo: null, revision: 1, value: x.value, unit: "x", frequency: "monthly", leadClass: "LAGGING" as const, sourceReliability: 1, independenceGroup: "test", contentHash: `t-${i}`, isRevision: false, supersedesId: null, metadata: {}, createdAt: x.date })),
    ];
    const results = discoverLeadingSignals(observations, "series:target", [30, 90]);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.signalKey).toBe("series:signal_a");
  });
});
