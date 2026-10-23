import { describe, expect, it } from "vitest";
import { enrichListing, priorityBreakdown, latestStatsByCity } from "./deals";

const stats = latestStatsByCity([
  {
    id: "1",
    city: "Brno",
    period: "2026-06-01",
    avg_asking_price_m2: 100000,
    avg_rent_m2: 300,
    listings_count: 400,
    is_sample: true,
    created_at: "",
  },
  {
    id: "2",
    city: "Brno",
    period: "2026-09-01",
    avg_asking_price_m2: 110000,
    avg_rent_m2: 330,
    listings_count: 400,
    is_sample: true,
    created_at: "",
  },
]);
const listing = {
  id: "l1",
  property_id: "p1",
  price: 5_000_000,
  area_m2: 50,
  location: "Brno",
  availability_status: "ACTIVE_CONFIRMED",
  freshness_status: "FRESH",
  is_sample: true,
} as never;

describe("enrichListing", () => {
  it("uses the latest market period and existing engines", () => {
    const e = enrichListing(listing, null, stats, []);
    expect(e.estimate?.estimatedValue).toBe(5_500_000);
    expect(e.rent).toBe(16_500);
    expect(e.diffBps).toBe(-909);
    expect(e.isSample).toBe(true);
    expect(e.reasons.some((r) => r.text.includes("pod odhadem"))).toBe(true);
    expect(e.reasons.some((r) => !r.positive && r.text.includes("nízká jistota"))).toBe(true);
  });
  it("breakdown sums to the priority score", () => {
    const e = enrichListing(listing, null, stats, []);
    const sum = priorityBreakdown(e).reduce((a, b) => a + b.points, 0);
    expect(Math.abs(sum - e.priority)).toBeLessThanOrEqual(2);
  });
  it("detects price drops from snapshots", () => {
    const snaps = [
      {
        id: "a",
        listing_id: "l1",
        price: 5_200_000,
        availability_status: "ACTIVE_CONFIRMED",
        observed_at: "2026-08-01",
        raw: null,
      },
      {
        id: "b",
        listing_id: "l1",
        price: 5_000_000,
        availability_status: "ACTIVE_CONFIRMED",
        observed_at: "2026-09-01",
        raw: null,
      },
    ] as never;
    expect(enrichListing(listing, null, stats, snaps).priceDropped).toBe(true);
  });
  it("prefers an older live market stat over a newer sample stat", () => {
    const live = latestStatsByCity([
      {
        id: "sample",
        city: "Brno",
        period: "2026-09-01",
        avg_asking_price_m2: 999999,
        avg_rent_m2: 1,
        listings_count: 1,
        is_sample: true,
        created_at: "",
      },
      {
        id: "live",
        city: "Brno",
        period: "2026-01-01",
        avg_asking_price_m2: 80000,
        avg_rent_m2: 250,
        listings_count: 12,
        is_sample: false,
        created_at: "",
      },
    ]);
    expect(live.get("Brno")?.avg_asking_price_m2).toBe(80000);
    expect(live.get("Brno")?.is_sample).toBe(false);
  });
  it("inactive listings score 0", () => {
    const e = enrichListing(
      { ...(listing as object), availability_status: "SOLD" } as never,
      null,
      stats,
      [],
    );
    expect(e.priority).toBe(0);
  });
});
