export const HOUSE_PRICE_HORIZON_QUARTERS = 4;
/** Days after quarter start. Eurostat HPI is published about a quarter after quarter-end; this is assumed, not an audited vintage. */
export const ASSUMED_HPI_PUBLICATION_LAG_DAYS = 210;

export type VintageQuality = "OBSERVED_VINTAGE" | "PUBLICATION_LAG_ASSUMED";

export type LevelObservation = {
  period: string;
  level: number;
  vintageDate: string;
  quality: VintageQuality;
};

export function quarterStartIso(period: string): string {
  const match = /^(\d{4})-Q([1-4])$/.exec(period.trim());
  if (!match) throw new Error(`Expected a quarter period YYYY-Qn, received ${period}.`);
  const month = (Number(match[2]) - 1) * 3 + 1;
  return `${match[1]}-${String(month).padStart(2, "0")}-01T00:00:00.000Z`;
}

export function addDays(iso: string, days: number): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) throw new Error(`Invalid date: ${iso}`);
  if (!Number.isFinite(days)) throw new Error("Lag days must be finite.");
  return new Date(time + days * 86_400_000).toISOString();
}

export function logReturn(later: number, earlier: number): number {
  if (!(later > 0) || !(earlier > 0) || !Number.isFinite(later) || !Number.isFinite(earlier)) {
    throw new Error("Log return requires finite positive levels.");
  }
  return Math.log(later) - Math.log(earlier);
}

export function quarterlyIndexToLevels(
  rows: readonly { period: string; value: number }[],
  lagDays = ASSUMED_HPI_PUBLICATION_LAG_DAYS,
): LevelObservation[] {
  if (!Number.isInteger(lagDays) || lagDays < 0) throw new Error("Publication lag must be a non-negative integer.");
  return rows.map((row) => {
    if (!Number.isFinite(row.value) || row.value <= 0) throw new Error(`Non-positive index at ${row.period}.`);
    const period = quarterStartIso(row.period);
    return {
      period,
      level: row.value,
      vintageDate: addDays(period, lagDays),
      quality: "PUBLICATION_LAG_ASSUMED" as const,
    };
  });
}

/** Latest vintage of each period that was already published at `asOf`. Later revisions and future periods stay invisible. */
export function levelsVisibleAt(
  rows: readonly LevelObservation[],
  asOf: string,
): LevelObservation[] {
  const cutoff = Date.parse(asOf);
  if (!Number.isFinite(cutoff)) throw new Error(`Invalid asOf: ${asOf}`);
  const best = new Map<string, LevelObservation>();
  for (const row of rows) {
    assertLevel(row);
    if (Date.parse(row.vintageDate) > cutoff) continue;
    const previous = best.get(row.period);
    if (!previous || Date.parse(previous.vintageDate) <= Date.parse(row.vintageDate)) best.set(row.period, row);
  }
  return [...best.values()].sort((a, b) => Date.parse(a.period) - Date.parse(b.period));
}

export function latestLevels(rows: readonly LevelObservation[]): LevelObservation[] {
  if (!rows.length) return [];
  const newest = rows.reduce((max, row) => Math.max(max, Date.parse(row.vintageDate)), 0);
  if (!Number.isFinite(newest)) throw new Error("Level series has no valid vintage.");
  return levelsVisibleAt(rows, new Date(newest).toISOString());
}

function assertLevel(row: LevelObservation): void {
  if (!Number.isFinite(row.level) || row.level <= 0) throw new Error("Level must be finite and positive.");
  const period = Date.parse(row.period);
  const vintage = Date.parse(row.vintageDate);
  if (!Number.isFinite(period) || !Number.isFinite(vintage)) throw new Error("Level period and vintage must be dates.");
  if (vintage < period) throw new Error(`Vintage precedes period for ${row.period}.`);
  if (row.quality !== "OBSERVED_VINTAGE" && row.quality !== "PUBLICATION_LAG_ASSUMED") {
    throw new Error("Unknown vintage quality.");
  }
}
