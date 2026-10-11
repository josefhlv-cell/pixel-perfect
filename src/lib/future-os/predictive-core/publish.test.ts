import { describe, expect, it } from "vitest";
import { HousePriceLedger } from "./ledger";
import { addQuarters, eurostatIndexRows, realizeSealedForecast, scoreFrozenForecast, sealHousePriceIndex, vintageOfQuarter } from "./publish";

function quarters(count: number, startYear = 2010): { period: string; value: number; availableAt: string }[] {
  return Array.from({ length: count }, (_, index) => {
    const year = startYear + Math.floor(index / 4);
    const quarter = (index % 4) + 1;
    const period = `${year}-Q${quarter}`;
    return { period, value: 100 + index, availableAt: vintageOfQuarter(period, 210) };
  });
}

describe("sealed house-price publication", () => {
  it("chooses duplicate period vintages by timestamp, not input order", () => {
    const rows = eurostatIndexRows([
      { value: { period: "2024-Q1", value: 101 }, availableAt: "2024-06-01T00:00:00.000Z" },
      { value: { period: "2024-Q1", value: 99 }, availableAt: "2024-05-01T00:00:00.000Z" },
    ]);
    expect(rows).toEqual([{
      period: "2024-Q1",
      value: 101,
      availableAt: "2024-06-01T00:00:00.000Z",
    }]);
  });

  it("scores only the newest outcome vintage available by the scoring cutoff", () => {
    const frozen = {
      p10: -0.1,
      p50: 0.05,
      p90: 0.1,
      probabilityPositive: 0.7,
      originLevel: 100,
      horizonPeriod: "2024-Q1",
    };
    const rows = [
      { period: "2024-Q1", value: 110, availableAt: "2024-05-01T00:00:00.000Z" },
      { period: "2024-Q1", value: 80, availableAt: "2024-07-01T00:00:00.000Z" },
    ];
    const early = scoreFrozenForecast(frozen, rows, "2024-06-01T00:00:00.000Z");
    const late = scoreFrozenForecast(frozen, rows, "2024-08-01T00:00:00.000Z");
    expect(early?.outcomeAsOf).toBe("2024-05-01T00:00:00.000Z");
    expect(early?.realized).toBeCloseTo(Math.log(1.1));
    expect(late?.outcomeAsOf).toBe("2024-07-01T00:00:00.000Z");
    expect(late?.realized).toBeCloseTo(Math.log(0.8));
  });
  it("freezes the origin and refuses to score the horizon before it is published", async () => {
    const rows = quarters(48);
    const asOf = vintageOfQuarter("2019-Q1", 210);
    const sealed = await sealHousePriceIndex({ rows, retrievedAt: asOf, horizonQuarters: 1 });
    expect(sealed.contractHash).toMatch(/^[a-f0-9]{64}$/);
    expect(sealed.report.issued?.originPeriod).toBe("2019-01-01T00:00:00.000Z");
    expect(sealed.horizonPeriod).toBe(addQuarters("2019-01-01T00:00:00.000Z", 1));
    expect(sealed.report.promotable).toBe(false);
    expect(realizeSealedForecast(sealed, rows, asOf)).toBeNull();

    const later = vintageOfQuarter("2019-Q2", 210);
    const realized = realizeSealedForecast(sealed, rows, later);
    expect(realized?.outcomeAsOf).toBe(vintageOfQuarter("2019-Q2", 210));
    expect(realized?.absoluteError).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(realized?.realized)).toBe(true);
  });

  it("keeps one journal row per contract hash and scores it only once the horizon exists", async () => {
    const rows = quarters(48);
    const asOf = vintageOfQuarter("2019-Q1", 210);
    const sealed = await sealHousePriceIndex({ rows, retrievedAt: asOf, horizonQuarters: 1 });
    const ledger = new HousePriceLedger();
    ledger.record(sealed, rows, asOf);
    ledger.record(sealed, rows, asOf);
    expect(ledger.list()).toHaveLength(1);
    expect(ledger.list()[0]?.realization).toBeNull();

    ledger.record(sealed, rows, vintageOfQuarter("2019-Q2", 210));
    expect(ledger.list()).toHaveLength(1);
    expect(Number.isFinite(ledger.list()[0]?.realization?.realized)).toBe(true);
  });
});
