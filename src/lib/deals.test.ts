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
    is_sample: false,
    created_at: "",
  },
  {
    id: "2",
    city: "Brno",
    period: "2026-09-01",
    avg_asking_price_m2: 110000,
    avg_rent_m2: 330,
    listings_count: 400,
    is_sample: false,
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
  it("prefers older live statistics over newer sample statistics for rent", () => {
    const base = { id: "stat", city: "Brno", listings_count: 3, created_at: "", avg_asking_price_m2: 100000 };
    const mixed = latestStatsByCity([
      { ...base, period: "2026-01-01", avg_rent_m2: 300, is_sample: false },
      { ...base, period: "2026-10-01", avg_rent_m2: 900, is_sample: true },
    ]);
    expect(enrichListing(listing, null, mixed, []).rent).toBe(15000);
    expect(latestStatsByCity([{ ...base, period: "2026-10-01", avg_rent_m2: 900, is_sample: true }]).size).toBe(0);
  });
  it("does not enrich a live listing with a sample property", () => {
    const e = enrichListing(
      { ...(listing as object), is_sample: false, area_m2: null, location: null } as never,
      { id: "p1", is_sample: true, city: "Brno", area_m2: 50 } as never,
      stats,
      [],
    );
    expect(e.property).toBeNull();
    expect(e.rent).toBeNull();
    expect(e.estimate).toBeNull();
  });
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
