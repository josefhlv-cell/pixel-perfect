import { describe, expect, it } from "vitest";
import { aggregateHistoricalScores, scoreHistoricalForecast } from "./time-machine-scoring";

describe("Historical Time Machine scoring", () => {
  it("scores probabilistic and point forecasts", () => {
    const score = scoreHistoricalForecast(
      { checkpointAsOf: "2020-01-01T00:00:00Z", horizonDays: 365, p10: 98, p50: 105, p90: 112, probabilityPositive: 0.8 },
      { realizedValue: 108, baselineValue: 100 },
    );
    expect(score.directionalHit).toBe(true);
    expect(score.intervalCovered).toBe(true);
    expect(score.brierScore).toBeLessThan(0.1);
  });

  it("aggregates walk-forward performance", () => {
    const score = scoreHistoricalForecast(
      { checkpointAsOf: "2020-01-01T00:00:00Z", horizonDays: 365, p10: 98, p50: 105, p90: 112, probabilityPositive: 0.8 },
      { realizedValue: 108, baselineValue: 100 },
    );
    const aggregate = aggregateHistoricalScores([score, score]);
    expect(aggregate?.sampleCount).toBe(2);
    expect(aggregate?.mae).toBe(3);
  });
});
