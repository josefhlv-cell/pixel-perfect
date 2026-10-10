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
