import type { EvidenceObservation, FutureRadarFoundation } from "./types";
import { computeDataQuality, getEvidenceAvailableAt } from "./point-in-time";

export function buildFutureRadarFoundation(
  rows: EvidenceObservation[],
  asOf: Date | string,
  requiredFields: string[] = [],
): FutureRadarFoundation {
  const evidence = getEvidenceAvailableAt(rows, asOf);
  const quality = computeDataQuality(evidence, requiredFields);
  const leadingSignals = evidence.filter((row) => row.leadClass === "LEADING");

  const status = quality.status === "DATA_STARVED"
    ? "DATA_STARVED"
    : leadingSignals.length === 0
      ? "CONTESTED"
      : "CLEAR";

  return {
    currentState: Object.fromEntries(
      evidence.map((row) => [row.entityType + ":" + row.entityKey, row.value]),
    ),
    leadingSignals,
    dataQuality: quality,
    modelReady: quality.status === "READY" && leadingSignals.length > 0,
    status,
    nextBestObservation: {
      required: quality.status !== "READY" || leadingSignals.length === 0,
      reason: quality.status === "DATA_STARVED"
        ? "Chybí dostatečně kvalitní point-in-time evidence; systém nemá bezpečný základ pro predikci."
        : leadingSignals.length === 0
          ? "Nemáme identifikovaný leading signal. Nejvyšší hodnota dalšího pozorování bude v datech, která mohou odlišit konkurenční hypotézy."
          : "Základní evidence je připravena; další pozorování má smysl vybírat podle očekávaného informačního zisku.",
    },
  };
}
