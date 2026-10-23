import { describe, expect, it } from "vitest";
import {
  enrichListing,
  priorityBreakdown,
  latestStatsByCity,
  rentalComparablesFromListings,
  saleComparablesFromListings,
} from "./deals";

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
  it("does not invent property-level rent from city averages", () => {
    const base = {
      id: "stat",
      city: "Brno",
      listings_count: 3,
      created_at: "",
      avg_asking_price_m2: 100000,
    };
    const mixed = latestStatsByCity([
      { ...base, period: "2026-01-01", avg_rent_m2: 300, is_sample: false },
      { ...base, period: "2026-10-01", avg_rent_m2: 900, is_sample: true },
    ]);
    expect(enrichListing(listing, null, mixed, []).rent).toBeNull();
    expect(
      latestStatsByCity([{ ...base, period: "2026-10-01", avg_rent_m2: 900, is_sample: true }])
        .size,
    ).toBe(0);
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
  it("does not label city-level averages as a property valuation or rent", () => {
    const e = enrichListing(listing, null, stats, []);
    expect(e.estimate).toBeNull();
    expect(e.rent).toBeNull();
    expect(e.diffBps).toBeNull();
    expect(e.isSample).toBe(true);
    expect(e.reasons.some((r) => r.text.includes("pod odhadem"))).toBe(false);
    expect(e.reasons.some((r) => r.text.includes("srovnatelné nabídky"))).toBe(true);
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

const rentalRow = (i: number, rent = 15000) =>
  ({
    id: `r${i}`,
    property_id: `rp${i}`,
    offer_type: "pronajem",
    price: rent + i * 100,
    area_m2: 48 + (i % 5),
    location: "Brno",
    rooms: "2+kk",
    source_url: `https://example.test/pronajem/${i}`,
    availability_status: "ACTIVE_CONFIRMED",
    freshness_status: "FRESH",
    last_verified_at: "2026-10-01T10:00:00.000Z",
    last_seen_at: "2026-10-01T10:00:00.000Z",
    updated_at: "2026-10-01T10:00:00.000Z",
    created_at: "2026-09-01T10:00:00.000Z",
    is_sample: false,
  }) as never;

describe("rental evidence pool", () => {
  it("builds rental comparables only from rental listings", () => {
    const rows = [rentalRow(1), rentalRow(2), { ...(listing as object), offer_type: "prodej" }];
    const pool = rentalComparablesFromListings(rows as never[], new Map());
    expect(pool).toHaveLength(2);
    expect(pool[0]!.monthlyRentCzk).toBeGreaterThan(0);
  });
  it("never lets monthly rents into the sale comparables pool", () => {
    const rows = [rentalRow(1), rentalRow(2)];
    expect(saleComparablesFromListings(rows as never[], new Map())).toHaveLength(0);
  });
  it("estimates rent from five or more real rental listings", () => {
    const rows = [rentalRow(1), rentalRow(2), rentalRow(3), rentalRow(4), rentalRow(5)];
    const rentals = rentalComparablesFromListings(rows as never[], new Map());
    const saleListing = {
      ...(listing as object),
      offer_type: "prodej",
      is_sample: false,
      rooms: "2+kk",
    } as never;
    const e = enrichListing(saleListing, null, stats, [], [], rentals);
    expect(e.rent).not.toBeNull();
    expect(e.rentEstimate?.comparableCount).toBe(5);
    expect(e.rentEstimate?.method).toBe("similarity_weighted_median");
  });
  it("returns no rent estimate with insufficient rental evidence", () => {
    const rentals = rentalComparablesFromListings([rentalRow(1), rentalRow(2)] as never[], new Map());
    const e = enrichListing(
      { ...(listing as object), offer_type: "prodej", is_sample: false, rooms: "2+kk" } as never,
      null,
      stats,
      [],
      [],
      rentals,
    );
    expect(e.rent).toBeNull();
    expect(e.grossYieldBps).toBeNull();
    expect(e.monthlyCashFlow).toBeNull();
  });
  it("treats a rental listing as rent evidence, not a sale target", () => {
    const e = enrichListing(rentalRow(1), null, stats, []);
    expect(e.estimate).toBeNull();
    expect(e.rent).toBeNull();
    expect(e.diffBps).toBeNull();
    expect(e.reasons.some((r) => r.text.includes("Odhad nájmu není k dispozici"))).toBe(false);
  });
});
