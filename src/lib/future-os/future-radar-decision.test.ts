import { describe, expect, it } from "vitest";
import { buildFutureRadarDecision } from "./future-radar-decision";

describe("Future Radar evidence status", () => {
  it("does not report CLEAR when forecast history is empty", () => {
    const result = buildFutureRadarDecision({
      driftMetrics: [],
      forecastHistory: [],
      hypotheses: [],
      observations: [],
      dataReady: true,
      modelDisagreement: 0,
    });
    expect(result.status).toBe("DATA_STARVED");
    expect(result.modelTrust.trustScore).toBe(0.65);
    expect(result.explanation.some((line) => line.includes("DATA_STARVED"))).toBe(true);
  });

  it("keeps a ready radar contested when models materially disagree", () => {
    const history = Array.from({ length: 16 }, (_, i) => ({
      asOf: new Date(Date.UTC(2024 + Math.floor(i / 12), i % 12, 1)).toISOString(),
      absoluteError: 1,
      directionalHit: true,
      intervalCovered: true,
    }));
    const result = buildFutureRadarDecision({
      driftMetrics: [],
      forecastHistory: history,
      hypotheses: [],
      observations: [],
      dataReady: true,
      modelDisagreement: 0.5,
    });
    expect(result.status).toBe("CONTESTED");
  });
});
