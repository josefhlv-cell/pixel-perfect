import { evaluateForecastHealth } from "./forecast-health";
import { evaluateModelTrust } from "./model-trust";
import { detectRegimeBreak, type DriftMetric } from "./drift";
import { nextBestObservation, type Hypothesis, type ObservationCandidate } from "./hypothesis-engine";

export type FutureRadarDecision = {
  status: "CLEAR" | "CONTESTED" | "DATA_STARVED" | "REGIME_BREAK";
  modelTrust: ReturnType<typeof evaluateModelTrust>;
  regime: ReturnType<typeof detectRegimeBreak>;
  nextBestObservation: ReturnType<typeof nextBestObservation>[number] | null;
  explanation: string[];
};

export function buildFutureRadarDecision(input: {
  driftMetrics: DriftMetric[];
  forecastHistory: Parameters<typeof evaluateModelTrust>[1];
  hypotheses: Hypothesis[];
  observations: ObservationCandidate[];
  dataReady: boolean;
  modelDisagreement: number;
}): FutureRadarDecision {
  const regime = detectRegimeBreak(input.driftMetrics);
  const modelTrust = evaluateModelTrust(input.driftMetrics, input.forecastHistory);
  const forecastHealth = evaluateForecastHealth(input.forecastHistory);
  const evidenceInsufficient = forecastHealth.status === "INSUFFICIENT_DATA";
  const next = nextBestObservation(input.hypotheses, input.observations)[0] ?? null;
  const explanation: string[] = [];

  if (!input.dataReady || evidenceInsufficient) {
    explanation.push("Radar je DATA_STARVED: chybí dostatečná evidence pro ověření predikční výkonnosti.");
  }
  if (regime.regime === "REGIME_BREAK") {
    explanation.push("Byl detekován režimový zlom; historické vztahy mají sníženou přenositelnost.");
  }
  if (input.modelDisagreement >= 0.35) {
    explanation.push("Modely se významně rozcházejí.");
  }
  if (modelTrust.action !== "KEEP_CHAMPION") {
    explanation.push("Champion model nemá plnou důvěru.");
  }
  if (next) {
    explanation.push("Nejvyšší informační hodnotu má další pozorování: " + next.key + ".");
  }

  const status =
    !input.dataReady || evidenceInsufficient ? "DATA_STARVED" :
    regime.regime === "REGIME_BREAK" ? "REGIME_BREAK" :
    input.modelDisagreement >= 0.35 ? "CONTESTED" :
    "CLEAR";

  return { status, modelTrust, regime, nextBestObservation: next, explanation };
}
