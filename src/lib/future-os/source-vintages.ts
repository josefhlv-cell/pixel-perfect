import { createHash } from "node:crypto";
import type { Json } from "@/integrations/supabase/types";
import type { EvidenceObservation } from "./types";
import { CZECH_HPI_SERIES } from "./predictive-core/publish";

export type SourceVintageQuality =
  | "OBSERVED_VINTAGE"
  | "RETRIEVAL_SNAPSHOT"
  | "ASSUMED_PUBLICATION_LAG";

export type SourceVintage = {
  sourceKey: string;
  seriesKey: string;
  geographyKey: string;
  periodKey: string;
  sourcePublishedAt: string | null;
  retrievedAt: string;
  sourceRevision: string | null;
  numericValue: number | null;
  unit: string | null;
  payloadHash: string;
  quality: SourceVintageQuality;
};

/**
 * Reconstructs what this application had actually retrieved by an as-of time.
 * This is NOT equivalent to a source-published vintage unless quality is
 * OBSERVED_VINTAGE and sourcePublishedAt/revision are genuinely source supplied.
 */
export function sourceVintagesVisibleAt(
  rows: readonly SourceVintage[],
  asOf: string,
  keys?: { sourceKey?: string; seriesKey?: string; geographyKey?: string },
): SourceVintage[] {
  const cutoff = Date.parse(asOf);
  if (!Number.isFinite(cutoff)) throw new Error(`Invalid asOf timestamp: ${asOf}`);

  const latest = new Map<string, SourceVintage>();
  for (const row of rows) {
    validateVintage(row);
    if (Date.parse(row.retrievedAt) > cutoff) continue;
    if (keys?.sourceKey && row.sourceKey !== keys.sourceKey) continue;
    if (keys?.seriesKey && row.seriesKey !== keys.seriesKey) continue;
    if (keys?.geographyKey && row.geographyKey !== keys.geographyKey) continue;

    const identity = [row.sourceKey, row.seriesKey, row.geographyKey, row.periodKey].join("\u001f");
    const previous = latest.get(identity);
    if (!previous || Date.parse(row.retrievedAt) > Date.parse(previous.retrievedAt)) {
      latest.set(identity, row);
    }
  }

  return [...latest.values()].sort((a, b) =>
    a.periodKey.localeCompare(b.periodKey) ||
    a.sourceKey.localeCompare(b.sourceKey) ||
    a.geographyKey.localeCompare(b.geographyKey),
  );
}

export function validateVintage(row: SourceVintage): void {
  if (!row.sourceKey.trim() || !row.seriesKey.trim() || !row.geographyKey.trim() || !row.periodKey.trim()) {
    throw new Error("Source vintage identity fields must not be empty.");
  }
  if (!Number.isFinite(Date.parse(row.retrievedAt))) {
    throw new Error("Source vintage retrievedAt must be a valid timestamp.");
  }
  if (row.sourcePublishedAt !== null && !Number.isFinite(Date.parse(row.sourcePublishedAt))) {
    throw new Error("Source vintage sourcePublishedAt must be null or a valid timestamp.");
  }
  if (row.numericValue !== null && !Number.isFinite(row.numericValue)) {
    throw new Error("Source vintage numericValue must be finite or null.");
  }
  if (!/^[a-f0-9]{64}$/i.test(row.payloadHash)) {
    throw new Error("Source vintage payloadHash must be a SHA-256 hex digest.");
  }
  if (!["OBSERVED_VINTAGE", "RETRIEVAL_SNAPSHOT", "ASSUMED_PUBLICATION_LAG"].includes(row.quality)) {
    throw new Error("Unknown source vintage quality.");
  }
  if (row.quality === "OBSERVED_VINTAGE" && (!row.sourcePublishedAt || !row.sourceRevision)) {
    throw new Error("Observed vintages require source-supplied publication time and revision.");
  }
}


export type SourceVintageInsert = {
  source_key: string;
  series_key: string;
  geography_key: string;
  period_key: string;
  source_published_at: string | null;
  retrieved_at: string;
  source_revision: string | null;
  numeric_value: number;
  unit: string;
  raw_payload: Json;
  payload_hash: string;
  quality: "RETRIEVAL_SNAPSHOT";
};

/** Map live source observations to deterministic immutable retrieval snapshots. */
export function toSourceVintageInserts(
  observations: readonly EvidenceObservation[],
): SourceVintageInsert[] {
  const snapshots: SourceVintageInsert[] = [];
  for (const observation of observations) {
    const raw = observation.value;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const value = raw as Record<string, unknown>;
    const period = typeof value.period === "string" ? value.period : null;
    const numericValue = typeof value.value === "number" ? value.value : null;
    if (!period || !/^\\d{4}-Q[1-4]$/.test(period) || numericValue == null || !Number.isFinite(numericValue)) continue;
    if (!observation.retrievedAt || !Number.isFinite(Date.parse(observation.retrievedAt))) continue;

    const sourceRevision = typeof observation.metadata.eurostatDatasetUpdatedAt === "string"
      ? observation.metadata.eurostatDatasetUpdatedAt
      : null;
    const canonical = JSON.stringify({
      source: "eurostat-prc-hpi-q",
      series: CZECH_HPI_SERIES,
      geography: observation.geographyKey,
      period,
      value: numericValue,
      unit: observation.unit,
      sourceRevision,
    });
    snapshots.push({
      source_key: "eurostat-prc-hpi-q",
      series_key: CZECH_HPI_SERIES,
      geography_key: observation.geographyKey,
      period_key: period,
      source_published_at: observation.publishedAt,
      retrieved_at: observation.retrievedAt,
      source_revision: sourceRevision,
      numeric_value: numericValue,
      unit: observation.unit ?? "index_2015_100",
      raw_payload: {
        value: numericValue,
        period,
        sourceUrl: observation.sourceUrl,
        observedAt: observation.observedAt,
        retrievedAt: observation.retrievedAt,
        availableAt: observation.availableAt,
        sourceRevision,
        quality: "RETRIEVAL_SNAPSHOT",
      },
      payload_hash: createHash("sha256").update(canonical).digest("hex"),
      quality: "RETRIEVAL_SNAPSHOT",
    });
  }
  return snapshots;
}
