import { describe, expect, it } from "vitest";
import { propagateCausalSignal } from "./causal";
import { validateForecastInput, scoreForecast } from "./forecast";
import { buildFutureRadarFoundation } from "./future-radar";
import { getEvidenceAvailableAt } from "./point-in-time";
import { discoverLeadingSignals, parseEvidenceNumericValue } from "./signal-discovery";
import { scoreHistoricalForecast } from "./time-machine-scoring";
import type { EvidenceObservation } from "./types";

/** Mirrors evidence.server mapRow: jsonb `value` is forwarded unchanged. */
function czech(n: number) {
  const sign = n < 0 ? "-" : "";
  const [whole, frac] = Math.abs(n).toFixed(1).split(".");
  const grouped = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${grouped},${frac}`;
}

function month(index: number) {
  return new Date(Date.UTC(2024, index, 1)).toISOString();
}

function row(
  index: number,
  entityKey: "rate" | "hpi",
  level: number,
  availableAt = month(index),
): EvidenceObservation {
  const date = month(index);
  return {
    id: `${entityKey}-${index}`,
    sourceId: "cnb-arad",
    sourceName: "ČNB ARAD",
    sourceType: "official_statistical",
    sourceUrl: null,
    publisher: "ČNB",
    geographyType: "country",
    geographyKey: "CZ",
    entityType: "macro_indicator",
    entityKey,
    observedAt: date,
    publishedAt: null,
    retrievedAt: availableAt,
    availableAt,
    effectiveFrom: date,
    effectiveTo: null,
    revision: 1,
    value: { value: null, raw: czech(level), snapshot_id: "local" },
    unit: "index",
    frequency: "monthly",
    leadClass: entityKey === "rate" ? "LEADING" : "LAGGING",
    sourceReliability: 0.9,
    independenceGroup: "cnb",
    contentHash: `${entityKey}-${index}`,
    isRevision: false,
    supersedesId: null,
    metadata: {},
    createdAt: availableAt,
  };
}

describe("Future OS prediction chain without a database", () => {
  const history = Array.from({ length: 16 }, (_, index) => [
    row(index, "rate", 1000 + index * 10),
    row(index, "hpi", 2000 + index * 20),
  ]).flat();
  const realized = row(16, "hpi", 2320, month(17));
  const cutoff = "2025-04-15T00:00:00.000Z";

  it("keeps importer JSON through the cutoff, then discovers and scores a forecast", () => {
    const visible = getEvidenceAvailableAt([...history, realized], cutoff);
    expect(visible.map((item) => item.id)).not.toContain(realized.id);
    expect(visible.every((item) => parseEvidenceNumericValue(item.value) != null)).toBe(true);

    const stored = visible.find((item) => item.id === "hpi-15");
    expect(stored?.value).toEqual({ value: null, raw: czech(2300), snapshot_id: "local" });
    expect(parseEvidenceNumericValue(stored?.value)).toBe(2300);

    const signals = discoverLeadingSignals(visible, "macro_indicator:hpi", [30]);
    expect(signals[0]?.signalKey).toBe("macro_indicator:rate");
    expect(signals[0]?.status).not.toBe("REJECTED");

    const hpi = visible
      .filter((item) => item.entityKey === "hpi")
      .map((item) => parseEvidenceNumericValue(item.value))
      .filter((value): value is number => value != null);
    const baseline = hpi.at(-1)!;
    const deltas = hpi.slice(1).map((value, index) => value - hpi[index]!);
    const meanDelta = deltas.reduce((sum, value) => sum + value, 0) / deltas.length;
    const draft = {
      forecast_key: "cz-hpi-30",
      geography_type: "country",
      geography_key: "CZ",
      target_key: "macro_indicator:hpi",
      horizon_days: 30,
      data_cutoff: cutoff,
      model_version: "local-chain-check",
      baseline_version: "mean-change",
      p10: baseline + meanDelta - 50,
      p50: baseline + meanDelta,
      p90: baseline + meanDelta + 50,
      probability_positive: meanDelta >= 0 ? 0.7 : 0.3,
      status: "PENDING" as const,
      evidence_ids: visible.map((item) => item.id),
      signal_ids: [signals[0]!.signalKey],
    };

    expect(draft.evidence_ids).not.toContain(realized.id);
    expect(draft.p50).toBe(2320);
    validateForecastInput({
      dataCutoff: draft.data_cutoff,
      evidence: visible,
      p10: draft.p10,
      p50: draft.p50,
      p90: draft.p90,
      probabilityPositive: draft.probability_positive,
      modelVersion: draft.model_version,
      baselineVersion: draft.baseline_version,
    });
    expect(() =>
      validateForecastInput({
        dataCutoff: draft.data_cutoff,
        evidence: [...visible, realized],
        p10: draft.p10,
        p50: draft.p50,
        p90: draft.p90,
        probabilityPositive: draft.probability_positive,
        modelVersion: draft.model_version,
        baselineVersion: draft.baseline_version,
      }),
    ).toThrow(/Point-in-time violation/);

    const realizedLevel = parseEvidenceNumericValue(realized.value)!;
    const point = scoreForecast(
      {
        dataCutoff: draft.data_cutoff,
        evidence: visible,
        p10: draft.p10,
        p50: draft.p50,
        p90: draft.p90,
        probabilityPositive: draft.probability_positive,
        modelVersion: draft.model_version,
        baselineVersion: draft.baseline_version,
      },
      realizedLevel,
    );
    const historical = scoreHistoricalForecast(
      {
        checkpointAsOf: cutoff,
        horizonDays: draft.horizon_days,
        p10: draft.p10,
        p50: draft.p50,
        p90: draft.p90,
        probabilityPositive: draft.probability_positive,
      },
      { realizedValue: realizedLevel, baselineValue: baseline },
    );
    expect(point.insideInterval).toBe(true);
    expect(point.absoluteError).toBe(0);
    expect(historical.directionalHit).toBe(true);
    expect(historical.absoluteError).toBe(0);
    expect(historical.intervalCovered).toBe(true);
  });

  it("propagates a structured evidence value instead of dropping it", () => {
    const parent = row(0, "rate", 1234.5);
    const effects = propagateCausalSignal(
      [
        {
          edgeKey: "rate-to-hpi",
          parent: "macro_indicator:rate",
          child: "macro_indicator:hpi",
          expectedSign: 1,
          lagMinDays: 30,
          lagMaxDays: 90,
          strength: 0.8,
          confidence: 0.5,
          modelVersion: "local-chain-check",
        },
      ],
      [parent],
      month(1),
    );
    expect(effects).toHaveLength(1);
    expect(effects[0]?.parentValue).toBe(1234.5);
    expect(effects[0]?.parentEvidenceId).toBe(parent.id);
  });

  it("leaves the stored JSON intact on the radar while the parser still reads it", () => {
    const evidence = row(3, "hpi", 2060);
    const radar = buildFutureRadarFoundation([evidence], month(4));
    expect(radar.currentState["macro_indicator:hpi"]).toEqual(evidence.value);
    expect(parseEvidenceNumericValue(radar.currentState["macro_indicator:hpi"])).toBe(2060);
    expect(radar.modelReady).toBe(false);
  });
});
