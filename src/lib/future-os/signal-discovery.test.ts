import { describe, expect, it } from "vitest";
import { discoverLeadingSignals, evaluateLeadingSignal } from "./signal-discovery";
import type { EvidenceObservation } from "./types";

function series(offset = 0) {
  return Array.from({ length: 24 }, (_, i) => ({
    date: new Date(Date.UTC(2020 + Math.floor(i / 12), i % 12, 1)).toISOString(),
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

  it("uses wrapped ČNB values and the latest revision of a period, not the stale print", () => {
    const base = series();
    const wrapped = base.map((point, i) =>
      observation(`rev-${i}`, "signal_a", point.date, {
        value: point.value,
        raw: String(point.value),
        snapshot_id: null,
      }),
    );
    const stale = base.map((point, i) =>
      observation(`old-${i}`, "signal_a", point.date, 0, { revision: 1 }),
    );
    const revised = wrapped.map((row, i) => ({
      ...row,
      revision: 2,
      isRevision: true,
      id: `new-${i}`,
    }));
    const target = series(1).map((point, i) =>
      observation(`t-${i}`, "target", point.date, point.value),
    );
    const results = discoverLeadingSignals(
      [...stale, ...revised, ...target],
      "series:target",
      [30],
    );
    expect(results[0]?.signalKey).toBe("series:signal_a");
    expect(results[0]?.correlation ?? 0).toBeGreaterThan(0.9);
  });

  it("does not see a revision that was unavailable at the cutoff", () => {
    const signal = series().slice(0, 16);
    const rows = [
      ...signal.map((point, i) => observation(`s-${i}`, "signal_a", point.date, point.value)),
      ...signal.map((point, i) => observation(`t-${i}`, "target", point.date, point.value)),
      observation(
        "late",
        "signal_a",
        signal[0]!.date,
        { value: 50, raw: "50", snapshot_id: null },
        { revision: 2, availableAt: "2024-01-01T00:00:00.000Z" },
      ),
    ];
    const visible = discoverLeadingSignals(rows, "series:target", [0], {
      asOf: "2021-06-01T00:00:00.000Z",
    });
    const leaked = discoverLeadingSignals(rows, "series:target", [0]);
    expect(visible[0]?.correlation ?? 0).toBeGreaterThan(0.999);
    expect(leaked[0]?.correlation ?? 1).toBeLessThan(0.99);
  });
});

function observation(
  id: string,
  entityKey: string,
  date: string,
  value: unknown,
  extra: Partial<EvidenceObservation> = {},
): EvidenceObservation {
  const availableAt = extra.availableAt ?? date;
  return {
    id,
    sourceId: "test",
    sourceName: "test",
    sourceType: "test",
    sourceUrl: null,
    publisher: "test",
    geographyType: "country",
    geographyKey: "CZ",
    entityType: "series",
    entityKey,
    observedAt: date,
    publishedAt: date,
    retrievedAt: availableAt,
    availableAt,
    effectiveFrom: date,
    effectiveTo: null,
    revision: extra.revision ?? 1,
    value,
    unit: "x",
    frequency: "monthly",
    leadClass: entityKey === "target" ? "LAGGING" : "LEADING",
    sourceReliability: 1,
    independenceGroup: "test",
    contentHash: id,
    isRevision: (extra.revision ?? 1) > 1,
    supersedesId: null,
    metadata: {},
    createdAt: availableAt,
    ...extra,
  };
}
