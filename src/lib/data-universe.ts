/** Point-in-time dataset helpers: a row is usable only if it was available at the cutoff (not just its event time). */
export type TruthLevel = "MACRO" | "MARKET" | "LISTING" | "PROPERTY";
export interface UniverseRow {
  id: string;
  kind: TruthLevel;
  geography: string;
  eventTime: string;
  availableAt: string;
  value: number;
  unit: string;
  source: string;
  truthLevel: TruthLevel;
  quality: number;
}

export function pointInTimeDataset<T extends UniverseRow>(rows: T[], cutoff: string) {
  const c = new Date(cutoff).getTime();
  const kept = rows.filter((r) => new Date(r.availableAt).getTime() <= c && new Date(r.eventTime).getTime() <= c);
  return { cutoff, rows: kept, excluded: rows.length - kept.length };
}

/** Rows that would leak future information into a dataset built at `cutoff`. */
export function auditAvailability<T extends UniverseRow>(rows: T[], cutoff: string) {
  const c = new Date(cutoff).getTime();
  return rows
    .filter((r) => new Date(r.availableAt).getTime() > c)
    .map((r) => ({ id: r.id, issue: "AVAILABLE_AFTER_CUTOFF" as const, availableAt: r.availableAt }));
}
