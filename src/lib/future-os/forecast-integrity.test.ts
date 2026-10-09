import { describe, expect, it } from "vitest";
import { validateForecast, validateForecastOutcome } from "./forecast-integrity";

const validForecast = {
  checkpointAsOf: "2025-01-01T00:00:00Z",
  horizonDays: 365,
  p10: 90,
  p50: 100,
  p90: 115,
  probabilityPositive: 0.6,
};

describe("forecast integrity guards", () => {
  it("accepts a structurally valid forecast", () => {
    expect(validateForecast(validForecast)).toEqual({ valid: true, issues: [] });
  });

  it("rejects unordered quantiles", () => {
    const result = validateForecast({ ...validForecast, p10: 110 });
    expect(result.valid).toBe(false);
    expect(result.issues).toContain("quantiles must be ordered p10 <= p50 <= p90");
  });

  it("rejects invalid horizon, date and probability", () => {
    const result = validateForecast({
      ...validForecast,
      checkpointAsOf: "not-a-date",
      horizonDays: 0,
      probabilityPositive: 1.1,
    });
    expect(result.valid).toBe(false);
    expect(result.issues).toHaveLength(3);
  });

  it("rejects non-finite forecast values", () => {
    const result = validateForecast({ ...validForecast, p50: Number.NaN });
    expect(result.valid).toBe(false);
    expect(result.issues).toContain("p50 must be finite");
  });

  it("validates realized outcomes independently", () => {
    expect(validateForecastOutcome({ realizedValue: 100, baselineValue: 95 }).valid).toBe(true);
    expect(validateForecastOutcome({ realizedValue: Number.NaN, baselineValue: 95 })).toEqual({
      valid: false,
      issues: ["realizedValue must be finite"],
    });
  });
});
