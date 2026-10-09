import { describe, expect, it } from "vitest";
import { aggregateHistoricalScores, scoreHistoricalForecast } from "./time-machine-scoring";

describe("Historical Time Machine scoring", () => {
  const forecast = {
    checkpointAsOf: "2020-01-01T00:00:00Z",
    horizonDays: 365,
    p10: 98,
    p50: 105,
    p90: 112,
    probabilityPositive: 0.8,
  };
  const outcome = { realizedValue: 108, baselineValue: 100 };

  it("scores probabilistic and point forecasts", () => {
    const score = scoreHistoricalForecast(forecast, outcome);
    expect(score.directionalHit).toBe(true);
    expect(score.intervalCovered).toBe(true);
    expect(score.brierScore).toBeLessThan(0.1);
  });

  it("aggregates walk-forward performance", () => {
    const score = scoreHistoricalForecast(forecast, outcome);
    const aggregate = aggregateHistoricalScores([score, score]);
    expect(aggregate?.sampleCount).toBe(2);
    expect(aggregate?.mae).toBe(3);
  });

  it("rejects malformed forecasts instead of scoring them", () => {
    expect(() => scoreHistoricalForecast({ ...forecast, p10: 120 }, outcome)).toThrow(
      "Invalid forecast: quantiles must be ordered p10 <= p50 <= p90",
    );
  });

  it("rejects non-finite outcomes instead of returning misleading scores", () => {
    expect(() =>
      scoreHistoricalForecast(forecast, { ...outcome, realizedValue: Number.NaN }),
    ).toThrow("Invalid outcome: realizedValue must be finite");
  });

  it("does not count a zero-change forecast as a directional hit", () => {
    const score = scoreHistoricalForecast({ ...forecast, p50: 100 }, outcome);
    expect(score.directionalHit).toBe(false);
  });
});
