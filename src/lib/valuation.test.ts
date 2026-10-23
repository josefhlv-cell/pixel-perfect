import { describe, expect, it } from "vitest";
import {
  estimateValueFromComparables,
  type SaleComparable,
  type SaleTarget,
} from "./valuation";

const target: SaleTarget = {
  listingId: "target-listing",
  propertyId: "target-property",
  city: "Pardubice",
  district: "Zelené Předměstí",
  rooms: "2+1",
  propertyType: "byt",
  areaM2: 67,
};

const comparable = (i: number, price = 5_000_000): SaleComparable => ({
  listingId: `listing-${i}`,
  propertyId: `property-${i}`,
  sourceUrl: `https://example.test/flat/${i}`,
  city: "Pardubice",
  district: "Zelené Předměstí",
  rooms: "2+1",
  propertyType: "byt",
  areaM2: 65 + (i % 5),
  priceCzk: price + i * 10_000,
  observedAt: "2026-10-15T10:00:00.000Z",
  availability: "ACTIVE_CONFIRMED",
  freshness: "FRESH",
  isSample: false,
});

describe("estimateValueFromComparables", () => {
  it("does not fall back to city averages when comparable evidence is insufficient", () => {
    expect(
      estimateValueFromComparables(
        target,
        [comparable(1), comparable(2), comparable(3), comparable(4)],
        "2026-10-23T00:00:00.000Z",
      ),
    ).toBeNull();
  });

  it("uses a robust asking-price median and returns the evidence window", () => {
    const rows = [
      comparable(1),
      comparable(2),
      comparable(3),
      comparable(4),
      comparable(5),
      comparable(6),
      comparable(7, 20_000_000),
    ];
    const estimate = estimateValueFromComparables(target, rows, "2026-10-23T00:00:00.000Z");
    expect(estimate).not.toBeNull();
    expect(estimate!.method).toBe("active_listing_asking_comparables");
    expect(estimate!.comparables).toBe(7);
    expect(estimate!.estimatedValue).toBeLessThan(7_000_000);
    expect(estimate!.low).toBeLessThanOrEqual(estimate!.estimatedValue);
    expect(estimate!.high).toBeGreaterThanOrEqual(estimate!.estimatedValue);
    expect(estimate!.sources).toHaveLength(7);
  });

  it("excludes target duplicates, samples, inactive, stale, wrong-layout, distant-area and future rows", () => {
    const rows = [
      comparable(1), comparable(2), comparable(3), comparable(4), comparable(5),
      { ...comparable(6), listingId: target.listingId },
      { ...comparable(7), propertyId: target.propertyId },
      { ...comparable(8), isSample: true },
      { ...comparable(9), availability: "SOLD" },
      { ...comparable(10), freshness: "STALE" },
      { ...comparable(11), rooms: "3+1" },
      { ...comparable(12), areaM2: 120 },
      { ...comparable(13), observedAt: "2026-11-01T00:00:00.000Z" },
    ];
    const estimate = estimateValueFromComparables(target, rows, "2026-10-23T00:00:00.000Z");
    expect(estimate).not.toBeNull();
    expect(estimate!.comparables).toBe(5);
  });

  it("does not compare across cities or duplicate source URLs", () => {
    const rows = [
      comparable(1),
      comparable(2),
      comparable(3),
      comparable(4),
      comparable(5),
      comparable(6),
    ];
    rows[5] = { ...rows[5]!, sourceUrl: rows[0]!.sourceUrl };
    rows[4] = { ...rows[4]!, city: "Brno" };
    expect(estimateValueFromComparables(target, rows, "2026-10-23T00:00:00.000Z")).toBeNull();
  });

  it("is deterministic for a fixed as-of timestamp", () => {
    const rows = [comparable(1), comparable(2), comparable(3), comparable(4), comparable(5), comparable(6)];
    expect(estimateValueFromComparables(target, rows, "2026-10-23T00:00:00.000Z"))
      .toEqual(estimateValueFromComparables(target, rows, "2026-10-23T00:00:00.000Z"));
  });
});
