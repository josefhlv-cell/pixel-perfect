/**
 * Freshness Engine — pure, deterministic.
 * Invariants:
 *   UNKNOWN != ACTIVE, 404 != SOLD, AI cannot override explicit source status,
 *   STALE is never automatically ACTIVE, every verification produces an event.
 */

export type FreshnessStatus = "FRESH" | "RECENT" | "AGING" | "STALE" | "EXPIRED" | "UNKNOWN";
export type AvailabilityStatus =
  | "ACTIVE_CONFIRMED"
  | "ACTIVE_UNCONFIRMED"
  | "RESERVED"
  | "SOLD"
  | "REMOVED"
  | "EXPIRED"
  | "UNKNOWN";

const HOUR = 3600_000;
const DAY = 24 * HOUR;

/** Freshness by time since last successful verification. */
export function computeFreshnessStatus(lastVerifiedAt: Date | null, now: Date, publishedAt?: Date | null): FreshnessStatus {
  if (!lastVerifiedAt) return "UNKNOWN";
  const age = now.getTime() - lastVerifiedAt.getTime();
  if (age < 0) return "UNKNOWN";
  let status: FreshnessStatus;
  if (age <= 24 * HOUR) status = "FRESH";
  else if (age <= 3 * DAY) status = "RECENT";
  else if (age <= 7 * DAY) status = "AGING";
  else if (age <= 30 * DAY) status = "STALE";
  else status = "EXPIRED";
  // Listing published >30 days ago cannot be FRESH-ranked above RECENT.
  if (publishedAt && now.getTime() - publishedAt.getTime() > 30 * DAY && status === "FRESH") status = "RECENT";
  return status;
}

/** 0–100 score, decays with age. Unknown → null (never invented). */
export function computeFreshnessScore(lastVerifiedAt: Date | null, now: Date): number | null {
  if (!lastVerifiedAt) return null;
  const hours = Math.max(0, (now.getTime() - lastVerifiedAt.getTime()) / HOUR);
  return Math.max(0, Math.min(100, Math.round(100 * Math.exp(-hours / (24 * 7)))));
}

export type VerificationOutcome =
  | { kind: "ok"; http: 200; statusMarker?: "SOLD" | "RESERVED" | null; price?: number | null }
  | { kind: "not_found"; http: 404 | 410 }
  | { kind: "temporary_error"; http: number }
  | { kind: "blocked"; http: 403 | 429 };

export interface VerificationInput {
  previousStatus: AvailabilityStatus;
  previousPrice: number | null;
  outcome: VerificationOutcome;
  /** AI-suggested status — advisory only. */
  aiSuggestedStatus?: AvailabilityStatus | null;
}

export interface VerificationDecision {
  newStatus: AvailabilityStatus;
  confidence: number;
  verified: boolean; // whether last_verified_at should advance
  events: { type: string; http?: number; details?: Record<string, unknown> }[];
  newPrice: number | null;
}

/** Decide new availability from one verification attempt. Always returns ≥1 event. */
export function decideAvailability(input: VerificationInput): VerificationDecision {
  const { outcome, previousStatus, previousPrice } = input;
  const events: VerificationDecision["events"] = [];

  if (outcome.kind === "not_found") {
    // 404 means removed from source — NOT sold.
    events.push({ type: "not_found", http: outcome.http });
    return { newStatus: "REMOVED", confidence: 0.7, verified: true, events, newPrice: previousPrice };
  }
  if (outcome.kind === "temporary_error") {
    events.push({ type: "verification_failed", http: outcome.http });
    const downgraded: AvailabilityStatus =
      previousStatus === "ACTIVE_CONFIRMED" ? "ACTIVE_UNCONFIRMED" : previousStatus;
    return { newStatus: downgraded, confidence: 0.4, verified: false, events, newPrice: previousPrice };
  }
  if (outcome.kind === "blocked") {
    events.push({ type: "source_blocked", http: outcome.http });
    const downgraded: AvailabilityStatus =
      previousStatus === "ACTIVE_CONFIRMED" ? "ACTIVE_UNCONFIRMED" : previousStatus;
    return { newStatus: downgraded, confidence: 0.3, verified: false, events, newPrice: previousPrice };
  }

  // ok (200)
  let newStatus: AvailabilityStatus = "ACTIVE_CONFIRMED";
  let confidence = 0.9;
  if (outcome.statusMarker === "SOLD") {
    newStatus = "SOLD";
    events.push({ type: "status_marker", http: 200, details: { marker: "SOLD" } });
  } else if (outcome.statusMarker === "RESERVED") {
    newStatus = "RESERVED";
    events.push({ type: "status_marker", http: 200, details: { marker: "RESERVED" } });
  } else {
    if (previousStatus === "REMOVED" || previousStatus === "EXPIRED") {
      events.push({ type: "reappeared", http: 200 });
    }
    // AI disagreeing with an explicit source signal only lowers confidence; never overrides.
    if (input.aiSuggestedStatus && input.aiSuggestedStatus !== "ACTIVE_CONFIRMED") {
      confidence = 0.7;
      events.push({ type: "contradictory_signals", details: { ai: input.aiSuggestedStatus } });
    }
  }

  const price = outcome.price ?? null;
  const newPrice = price ?? previousPrice; // missing price is never invented — keep previous known
  if (price != null && previousPrice != null && price !== previousPrice) {
    events.push({
      type: price < previousPrice ? "price_decrease" : "price_increase",
      details: { from: previousPrice, to: price },
    });
  }
  if (price == null) events.push({ type: "price_missing" });

  events.push({ type: "verified", http: 200 });
  return { newStatus, confidence, verified: true, events, newPrice };
}

/** Effective status for display: STALE/EXPIRED freshness never shows as confirmed-active. */
export function effectiveAvailability(status: AvailabilityStatus, freshness: FreshnessStatus): AvailabilityStatus {
  if (status === "ACTIVE_CONFIRMED" && (freshness === "STALE" || freshness === "EXPIRED" || freshness === "UNKNOWN")) {
    return "ACTIVE_UNCONFIRMED";
  }
  return status;
}

/** Duplicate detection: same city + area within 2 % + same disposition + coords within ~150 m. */
export function isLikelyDuplicate(
  a: { city?: string | null; area_m2?: number | null; rooms?: string | null; lat?: number | null; lng?: number | null },
  b: { city?: string | null; area_m2?: number | null; rooms?: string | null; lat?: number | null; lng?: number | null },
): boolean {
  if (!a.city || !b.city || a.city !== b.city) return false;
  if (a.rooms && b.rooms && a.rooms !== b.rooms) return false;
  if (a.area_m2 == null || b.area_m2 == null) return false;
  if (Math.abs(a.area_m2 - b.area_m2) / Math.max(a.area_m2, b.area_m2) > 0.02) return false;
  if (a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
    const dLat = (a.lat - b.lat) * 111_000;
    const dLng = (a.lng - b.lng) * 111_000 * Math.cos((a.lat * Math.PI) / 180);
    if (Math.hypot(dLat, dLng) > 150) return false;
  }
  return true;
}

export function isActive(status: AvailabilityStatus): boolean {
  return status === "ACTIVE_CONFIRMED" || status === "ACTIVE_UNCONFIRMED";
}
