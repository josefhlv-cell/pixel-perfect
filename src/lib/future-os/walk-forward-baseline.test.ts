import { describe, expect, it } from "vitest";
import { backtestEvidenceSeries, selectLevelModel } from "./walk-forward-baseline";
import type { EvidenceObservation } from "./types";

function trend(n = 36) {
  return Array.from({ length: n }, (_, i) => ({
    date: new Date(Date.UTC(2018, i, 1)).toISOString(),
    value: 100 + i * 2,
  }));
}

function randomWalk(n: number, seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const points = [{ date: new Date(Date.UTC(2010, 0, 1)).toISOString(), value: 100 }];
  for (let i = 1; i < n; i++) {
    const shock = next() + next() - 1;
    points.push({
      date: new Date(Date.UTC(2010, i, 1)).toISOString(),
      value: points[i - 1]!.value + shock,
    });
  }
  return points;
}

function obs(
  partial: Pick<EvidenceObservation, "id" | "value" | "availableAt" | "effectiveFrom"> &
    Partial<EvidenceObservation>,
): EvidenceObservation {
  return {
    sourceId: "test",
    sourceName: "test",
    sourceType: "official_statistical",
    sourceUrl: null,
    publisher: "ČNB",
    geographyType: "country",
    geographyKey: "CZ",
    entityType: "macro_indicator",
    entityKey: "SFTP02M11",
    observedAt: partial.effectiveFrom,
    publishedAt: null,
    retrievedAt: partial.availableAt,
    effectiveTo: null,
    revision: 1,
    unit: "CZK",
    frequency: "monthly",
    leadClass: "UNKNOWN",
    sourceReliability: 0.98,
    independenceGroup: "cnb",
    contentHash: partial.id,
    isRevision: false,
    supersedesId: null,
    metadata: {},
    createdAt: partial.availableAt,
    ...partial,
  };
}

describe("walk-forward baseline", () => {
  it("selects drift on a persistent trend and beats the naive last value out of sample", () => {
    const result = selectLevelModel(trend(), { allowDrift: true });
    expect(result.status).toBe("SCORED");
    expect(result.selected).toBe("drift");
    expect(result.test.drift.mae ?? 1).toBeLessThan(result.test.naive_last.mae ?? 0);
    expect(result.test.drift.mae).toBeCloseTo(0, 8);
  });

  it("does not promote drift on a zero-mean random walk", () => {
    const result = selectLevelModel(randomWalk(80, 11));
    expect(result.status).toBe("SCORED");
    expect(result.selected).toBe("naive_last");
    expect(result.test.naive_last.mae).not.toBeNull();
  });

  it("can force the naive benchmark even when drift fits the train window", () => {
    const result = selectLevelModel(trend(), { allowDrift: false });
    expect(result.selected).toBe("naive_last");
    expect(result.reason).toBe("drift disabled");
  });

  it("blocks a historical skill claim when every ČNB row shares one retrieval time", () => {
    const retrievedAt = "2026-10-08T12:00:00.000Z";
    const rows = trend(24).map((point, i) =>
      obs({
        id: `batch-${i}`,
        effectiveFrom: point.date,
        availableAt: retrievedAt,
        value: { value: point.value, raw: String(point.value), snapshot_id: null },
      }),
    );
    const result = backtestEvidenceSeries(rows, "macro_indicator:SFTP02M11");
    expect(result.status).toBe("BLOCKED_SINGLE_VINTAGE");
    expect(result.selected).toBeNull();
    expect(result.test).toBeNull();
  });

  it("scores wrapped values only from vintages available before the outcome release", () => {
    const rows = trend(30).map((point, i) => {
      const published = new Date(Date.UTC(2018, i, 1) + 40 * 86_400_000).toISOString();
      return obs({
        id: `pit-${i}`,
        effectiveFrom: point.date,
        availableAt: published,
        publishedAt: published,
        value: { value: point.value, raw: String(point.value), snapshot_id: null },
      });
    });
    const leaked = obs({
      id: "future-revision",
      effectiveFrom: rows[0]!.effectiveFrom,
      availableAt: "2030-01-01T00:00:00.000Z",
      revision: 2,
      isRevision: true,
      value: { value: 999999, raw: "999999", snapshot_id: null },
    });
    const result = backtestEvidenceSeries([...rows, leaked], "macro_indicator:SFTP02M11");
    expect(result.status).toBe("SCORED");
    expect(result.selected).toBe("drift");
    expect(result.test?.drift.mae ?? 1).toBeLessThan(result.test?.naive_last.mae ?? 0);
    expect(result.test?.drift.mae ?? 1).toBeLessThan(1);
  });
});
