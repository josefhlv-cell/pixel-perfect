import { describe, expect, it } from "vitest";
import { estimateRentFromComparables, type RentalComparable, type RentTarget } from "./rent-model";

const target: RentTarget = {
  city: "Pardubice",
  district: "Zelené Předměstí",
  disposition: "2+1",
  areaM2: 67,
  condition: "dobrý",
  furnishing: "nezařízený",
  floor: 2,
  elevator: true,
  parking: false,
  storage: true,
  balcony: false,
};
const sample = (i: number, rent = 15000): RentalComparable => ({
  sourceUrl: `https://example.test/rent/${i}`,
  city: "Pardubice",
  district: "Zelené Předměstí",
  disposition: "2+1",
  areaM2: 64 + (i % 7),
  monthlyRentCzk: rent + i * 100,
  condition: "dobrý",
  furnishing: "nezařízený",
  floor: 2,
  elevator: true,
  parking: false,
  storage: true,
  balcony: false,
  observedAt: "2026-10-01T10:00:00.000Z",
  isActive: true,
  isVerified: true,
  isSample: false,
});

describe("estimateRentFromComparables", () => {
  it("returns null with fewer than five comparable real listings", () => {
    expect(
      estimateRentFromComparables(
        target,
        [sample(1), sample(2), sample(3), sample(4)],
        "2026-10-10T00:00:00.000Z",
      ),
    ).toBeNull();
  });
  it("uses a robust weighted median and exposes evidence count/range", () => {
    const rows = [
      sample(1),
      sample(2),
      sample(3),
      sample(4),
      sample(5),
      sample(6),
      sample(7, 90000),
    ];
    const result = estimateRentFromComparables(target, rows, "2026-10-10T00:00:00.000Z");
    expect(result).not.toBeNull();
    expect(result!.method).toBe("similarity_weighted_median");
    expect(result!.comparableCount).toBe(7);
    expect(result!.monthlyRentCzk).toBeLessThan(20000);
    expect(result!.highRentCzk).toBeLessThan(30000);
  });
  it("excludes samples, inactive, duplicate URLs, wrong layouts, distant areas and stale evidence", () => {
    const rows = [
      sample(1),
      sample(2),
      sample(3),
      sample(4),
      sample(5),
      { ...sample(6), isSample: true },
      { ...sample(7), isActive: false },
      { ...sample(8), sourceUrl: "https://example.test/rent/1" },
      { ...sample(9), disposition: "3+1" },
      { ...sample(10), areaM2: 110 },
      { ...sample(11), observedAt: "2025-01-01T00:00:00.000Z" },
    ];
    const result = estimateRentFromComparables(target, rows, "2026-10-10T00:00:00.000Z");
    expect(result).not.toBeNull();
    expect(result!.comparableCount).toBe(5);
    expect(result!.sources).not.toContain("https://example.test/rent/6");
    expect(result!.sources).not.toContain("https://example.test/rent/7");
    expect(result!.sources).not.toContain("https://example.test/rent/9");
    expect(result!.sources).not.toContain("https://example.test/rent/11");
  });
  it("is deterministic for a fixed as-of time", () => {
    const rows = [sample(1), sample(2), sample(3), sample(4), sample(5), sample(6)];
    expect(estimateRentFromComparables(target, rows, "2026-10-10T00:00:00.000Z")).toEqual(
      estimateRentFromComparables(target, rows, "2026-10-10T00:00:00.000Z"),
    );
  });
});
