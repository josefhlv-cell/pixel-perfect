import { describe, expect, it } from "vitest";
import { HousePriceLedger } from "./ledger";
import { addQuarters, realizeSealedForecast, sealHousePriceIndex, vintageOfQuarter } from "./publish";

function quarters(count: number, startYear = 2010): { period: string; value: number; availableAt: string }[] {
  return Array.from({ length: count }, (_, index) => {
    const year = startYear + Math.floor(index / 4);
    const quarter = (index % 4) + 1;
    const period = `${year}-Q${quarter}`;
    return { period, value: 100 + index, availableAt: vintageOfQuarter(period, 210) };
  });
}

describe("sealed house-price publication", () => {
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
