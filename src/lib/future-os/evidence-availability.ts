export type AvailabilityMode = "VINTAGE" | "PUBLISHED_AT" | "RETRIEVAL_CUTOFF" | "CURRENT_SNAPSHOT" | "UNKNOWN";

export function getAvailabilityMode(row: { publishedAt: string | null; metadata?: Record<string, unknown> }): AvailabilityMode {
  const mode = row.metadata?.availabilityMode;
  if (mode === "VINTAGE" || mode === "PUBLISHED_AT" || mode === "RETRIEVAL_CUTOFF" || mode === "CURRENT_SNAPSHOT") return mode;
  if (row.publishedAt) return "PUBLISHED_AT";
  return "UNKNOWN";
}

export function isBacktestSafe(row: { publishedAt: string | null; metadata?: Record<string, unknown> }): boolean {
  const mode = getAvailabilityMode(row);
  // Strict backtests must reject unknown provenance: without a known vintage or
  // publication timestamp we cannot prove the observation was knowable then.
  return mode === "VINTAGE" || mode === "PUBLISHED_AT";
}
