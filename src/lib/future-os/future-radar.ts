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


export type RadarForecast = {
  modelId: string;
  p10: number;
  p50: number;
  p90: number;
  probabilityPositive: number;
  confidence: number;
};

export type RadarHypothesis = {
  key: string;
  confidence: number;
  falsified: boolean;
};

export function buildFutureRadar(
  rows: EvidenceObservation[],
  asOf: Date | string,
  forecasts: RadarForecast[],
  hypotheses: RadarHypothesis[],
  requiredFields: string[] = [],
) {
  const foundation = buildFutureRadarFoundation(rows, asOf, requiredFields);
  if (foundation.status === "DATA_STARVED") {
    return { ...foundation, modelAgreement: null, contested: false };
  }

  const medians = forecasts.map((forecast) => forecast.p50);
  const sorted = [...medians].sort((a, b) => a - b);
  const centralEstimate = sorted.length
    ? sorted.length % 2 === 1
      ? sorted[Math.floor(sorted.length / 2)]
      : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : null;
  const spread = medians.length > 1
    ? Math.max(...medians) - Math.min(...medians)
    : 0;
  const scale = centralEstimate == null ? 1 : Math.max(1, Math.abs(centralEstimate));
  const disagreement = Math.min(1, spread / scale);
  const falsified = hypotheses.filter((hypothesis) => hypothesis.falsified).map((hypothesis) => hypothesis.key);
  const survivingConfidence = hypotheses.length
    ? hypotheses.filter((hypothesis) => !hypothesis.falsified).reduce((sum, hypothesis) => sum + hypothesis.confidence, 0) /
      Math.max(1, hypotheses.filter((hypothesis) => !hypothesis.falsified).length)
    : null;

  const contested = forecasts.length > 1 && disagreement >= 0.35;
  return {
    ...foundation,
    modelAgreement: {
      forecastCount: forecasts.length,
      centralEstimate,
      disagreement,
      survivingHypothesisConfidence: survivingConfidence,
    },
    contested,
    status: contested ? "CONTESTED" as const : foundation.status,
    falsifiedHypotheses: falsified,
    nextBestObservation: {
      required: foundation.nextBestObservation.required || contested,
      reason: contested
        ? "Modely se významně rozcházejí. Nejvyšší hodnota dalšího pozorování je v datech, která dokážou odlišit konkurenční mechanismy."
        : foundation.nextBestObservation.reason,
    },
  };
}
