import { realizeSealedForecast, type ForecastRealization, type IndexPoint, type SealedHousePriceForecast } from "./publish";

export type LedgerEntry = {
  sealed: SealedHousePriceForecast;
  realization: ForecastRealization | null;
};

/** Hash-keyed journal. A second copy of the same contract does not create a second prediction. */
export class HousePriceLedger {
  private readonly entries = new Map<string, LedgerEntry>();

  record(sealed: SealedHousePriceForecast, rows: readonly IndexPoint[], asOf: string): LedgerEntry {
    let entry = this.entries.get(sealed.contractHash);
    if (!entry) {
      entry = { sealed, realization: null };
      this.entries.set(sealed.contractHash, entry);
    }
    for (const prior of this.entries.values()) {
      prior.realization ??= realizeSealedForecast(prior.sealed, rows, asOf);
    }
    return entry;
  }

  list(): readonly LedgerEntry[] {
    return [...this.entries.values()];
  }
}
