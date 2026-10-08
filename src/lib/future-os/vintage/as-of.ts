import type { PublicationLag, VintageObservation, VintageQuery } from "./types";

export function isValidIsoDate(value: string): boolean {
  return Number.isFinite(new Date(value).getTime());
}

export function applyPublicationLag(
  observations: Array<Omit<VintageObservation, "vintageDate" | "quality">>,
  lags: PublicationLag[],
): VintageObservation[] {
  const lagMap = new Map(lags.map((lag) => [lag.series, lag]));
  return observations.map((row) => {
    const lag = lagMap.get(row.series);
    if (!lag) {
      throw new Error(`Missing publication lag for series: ${row.series}`);
    }

    const vintageDate = new Date(new Date(row.obsDate).getTime() + lag.lagDays * 86_400_000).toISOString();
    return {
      ...row,
      vintageDate,
      quality: lag.source === "OBSERVED" ? "OBSERVED_VINTAGE" : "PUBLICATION_LAG_ASSUMED",
    };
  });
}

export function asOf(
  observations: VintageObservation[],
  query: VintageQuery,
): VintageObservation[] {
  const cutoff = new Date(query.asOf).getTime();
  if (!Number.isFinite(cutoff)) throw new Error("Invalid asOf date.");

  return observations
    .filter((row) => new Date(row.vintageDate).getTime() <= cutoff)
    .filter((row) => !query.region || row.region === query.region)
    .filter((row) => !query.series || row.series === query.series)
    .filter((row) => !query.obsDateFrom || row.obsDate >= query.obsDateFrom)
    .filter((row) => !query.obsDateTo || row.obsDate <= query.obsDateTo)
    .sort((a, b) => {
      const dateDiff = new Date(a.obsDate).getTime() - new Date(b.obsDate).getTime();
      return dateDiff || new Date(a.vintageDate).getTime() - new Date(b.vintageDate).getTime();
    });
}

/**
 * Strict experiment gate. Assumed lags are allowed only when the experiment
 * explicitly permits them; they must never be silently treated as real vintages.
 */
export function assertVintageIntegrity(
  observations: VintageObservation[],
  allowAssumedLags = false,
): void {
  for (const row of observations) {
    if (!isValidIsoDate(row.obsDate) || !isValidIsoDate(row.vintageDate)) {
      throw new Error(`Invalid vintage date for ${row.region}/${row.series}.`);
    }
    if (new Date(row.vintageDate).getTime() < new Date(row.obsDate).getTime()) {
      throw new Error(`Vintage date precedes observation date for ${row.region}/${row.series}.`);
    }
    if (!allowAssumedLags && row.quality === "PUBLICATION_LAG_ASSUMED") {
      throw new Error(`Assumed publication lag is not allowed in strict vintage mode: ${row.series}`);
    }
  }
}