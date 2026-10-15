import { describe, expect, it } from "vitest";
import { backtestBaseline, forecastBaseline, type TimeSeriesPoint } from "./baseline-forecast";

const q = (i: number, value: number, lagDays = 45): TimeSeriesPoint => {
  const period = new Date(Date.UTC(2020, i * 3, 1));
  const avail = new Date(period.getTime() + lagDays * 86400000);
  return { period: period.toISOString(), value, availableAt: avail.toISOString() };
};

describe("baseline forecasts", () => {
  it("ignores values not yet published at origin", () => {
    const history = [q(0, 100), q(1, 110), q(2, 999, 400)];
    const r = forecastBaseline({
      history,
      origin: history[1]!.availableAt,
      horizonSteps: 1,
      method: "LAST_VALUE",
    });
    expect(r.prediction).toBe(110);
    expect(r.trainingPoints).toBe(2);
  });

  it("drift extrapolates the average step", () => {
    const history = [q(0, 100), q(1, 102), q(2, 104)];
    const r = forecastBaseline({ history, origin: history[2]!.availableAt, horizonSteps: 2, method: "DRIFT" });
    expect(r.prediction).toBe(108);
  });

  it("refuses to forecast with no available data", () => {
    expect(() =>
      forecastBaseline({ history: [q(5, 1)], origin: "2019-01-01", horizonSteps: 1, method: "LAST_VALUE" }),
    ).toThrow();
  });

  it("drift beats persistence on a linear trend in backtest", () => {
    const series = Array.from({ length: 12 }, (_, i) => q(i, 100 + 2 * i));
    const drift = backtestBaseline(series, "DRIFT");
    const last = backtestBaseline(series, "LAST_VALUE");
    expect(drift.n).toBe(8);
    expect(drift.mae).toBeCloseTo(0, 9);
    expect(last.mae).toBeCloseTo(2, 9);
    expect(drift.directionalAccuracy).toBe(1);
  });
});
