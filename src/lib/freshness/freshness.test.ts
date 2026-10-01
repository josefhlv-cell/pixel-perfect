import { describe, expect, it } from "vitest";
import { computeFreshnessStatus, decideAvailability, effectiveAvailability, isLikelyDuplicate } from "./index";

const now = new Date("2026-10-01T12:00:00Z");
const ago = (h: number) => new Date(now.getTime() - h * 3600_000);

describe("freshness status", () => {
  it("1 new listing → FRESH", () => expect(computeFreshnessStatus(ago(1), now)).toBe("FRESH"));
  it("2 active recent → RECENT", () => expect(computeFreshnessStatus(ago(48), now)).toBe("RECENT"));
  it("3 old verification → STALE", () => expect(computeFreshnessStatus(ago(24 * 10), now)).toBe("STALE"));
  it("never verified → UNKNOWN", () => expect(computeFreshnessStatus(null, now)).toBe("UNKNOWN"));
  it("18 listing older than 30 days is never FRESH", () =>
    expect(computeFreshnessStatus(ago(1), now, ago(24 * 40))).toBe("RECENT"));
});

describe("availability decisions", () => {
  it("4/7 removed listing (404) → REMOVED, not SOLD", () => {
    const d = decideAvailability({ previousStatus: "ACTIVE_CONFIRMED", previousPrice: 1, outcome: { kind: "not_found", http: 404 } });
    expect(d.newStatus).toBe("REMOVED");
    expect(d.newStatus).not.toBe("SOLD");
  });
  it("5 SOLD marker", () => {
    const d = decideAvailability({ previousStatus: "ACTIVE_CONFIRMED", previousPrice: 1, outcome: { kind: "ok", http: 200, statusMarker: "SOLD" } });
    expect(d.newStatus).toBe("SOLD");
  });
  it("6 RESERVED marker", () => {
    const d = decideAvailability({ previousStatus: "ACTIVE_CONFIRMED", previousPrice: 1, outcome: { kind: "ok", http: 200, statusMarker: "RESERVED" } });
    expect(d.newStatus).toBe("RESERVED");
  });
  it("8 temporary error downgrades, does not verify", () => {
    const d = decideAvailability({ previousStatus: "ACTIVE_CONFIRMED", previousPrice: 1, outcome: { kind: "temporary_error", http: 503 } });
    expect(d.newStatus).toBe("ACTIVE_UNCONFIRMED");
    expect(d.verified).toBe(false);
  });
  it("9 blocked source", () => {
    const d = decideAvailability({ previousStatus: "ACTIVE_CONFIRMED", previousPrice: 1, outcome: { kind: "blocked", http: 403 } });
    expect(d.newStatus).toBe("ACTIVE_UNCONFIRMED");
    expect(d.events[0]?.type).toBe("source_blocked");
  });
  it("10 price decrease event", () => {
    const d = decideAvailability({ previousStatus: "ACTIVE_CONFIRMED", previousPrice: 100, outcome: { kind: "ok", http: 200, price: 90 } });
    expect(d.events.map((e) => e.type)).toContain("price_decrease");
  });
  it("11 price increase event", () => {
    const d = decideAvailability({ previousStatus: "ACTIVE_CONFIRMED", previousPrice: 100, outcome: { kind: "ok", http: 200, price: 110 } });
    expect(d.events.map((e) => e.type)).toContain("price_increase");
  });
  it("12 reappeared listing", () => {
    const d = decideAvailability({ previousStatus: "REMOVED", previousPrice: 100, outcome: { kind: "ok", http: 200, price: 100 } });
    expect(d.events.map((e) => e.type)).toContain("reappeared");
  });
  it("14 missing price is not invented", () => {
    const d = decideAvailability({ previousStatus: "ACTIVE_CONFIRMED", previousPrice: null, outcome: { kind: "ok", http: 200, price: null } });
    expect(d.newPrice).toBeNull();
  });
  it("16/17 AI cannot override explicit source status", () => {
    const d = decideAvailability({
      previousStatus: "ACTIVE_CONFIRMED",
      previousPrice: 1,
      outcome: { kind: "ok", http: 200, statusMarker: "RESERVED" },
      aiSuggestedStatus: "ACTIVE_CONFIRMED",
    });
    expect(d.newStatus).toBe("RESERVED");
    const d2 = decideAvailability({
      previousStatus: "ACTIVE_CONFIRMED",
      previousPrice: 1,
      outcome: { kind: "ok", http: 200 },
      aiSuggestedStatus: "SOLD",
    });
    expect(d2.newStatus).toBe("ACTIVE_CONFIRMED");
    expect(d2.events.map((e) => e.type)).toContain("contradictory_signals");
  });
  it("every verification creates an event", () => {
    for (const outcome of [
      { kind: "ok", http: 200 } as const,
      { kind: "not_found", http: 404 } as const,
      { kind: "temporary_error", http: 500 } as const,
      { kind: "blocked", http: 429 } as const,
    ]) {
      expect(decideAvailability({ previousStatus: "UNKNOWN", previousPrice: null, outcome }).events.length).toBeGreaterThan(0);
    }
  });
  it("STALE is never shown as confirmed active; UNKNOWN != ACTIVE", () => {
    expect(effectiveAvailability("ACTIVE_CONFIRMED", "STALE")).toBe("ACTIVE_UNCONFIRMED");
    expect(effectiveAvailability("UNKNOWN", "FRESH")).toBe("UNKNOWN");
  });
});

describe("duplicates", () => {
  it("13 detects duplicate", () => {
    expect(
      isLikelyDuplicate(
        { city: "Pardubice", area_m2: 52, rooms: "2+kk", lat: 50.0469, lng: 15.7556 },
        { city: "Pardubice", area_m2: 52.5, rooms: "2+kk", lat: 50.047, lng: 15.7557 },
      ),
    ).toBe(true);
  });
  it("different disposition is not duplicate", () => {
    expect(isLikelyDuplicate({ city: "Brno", area_m2: 60, rooms: "2+1" }, { city: "Brno", area_m2: 60, rooms: "3+1" })).toBe(false);
  });
  it("15 missing area cannot match", () => {
    expect(isLikelyDuplicate({ city: "Brno", area_m2: null }, { city: "Brno", area_m2: 60 })).toBe(false);
  });
});
