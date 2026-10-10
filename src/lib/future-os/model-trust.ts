import { evaluateForecastHealth } from "./forecast-health";
import { detectRegimeBreak, type DriftMetric } from "./drift";

export type TrustDecision = {
  trustScore: number;
  action: "KEEP_CHAMPION" | "WATCH_CHAMPION" | "DEMOTE_CHAMPION" | "RETRAIN";
  reasons: string[];
};

export function evaluateModelTrust(
  driftMetrics: DriftMetric[],
  forecastHistory: Parameters<typeof evaluateForecastHealth>[0],
): TrustDecision {
  const regime = detectRegimeBreak(driftMetrics);
  const health = evaluateForecastHealth(forecastHistory);
  let trustScore = 1;
  const reasons: string[] = [];

  if (regime.regime === "REGIME_WARNING") {
    trustScore -= 0.2;
    reasons.push("Tržní charakteristiky vykazují režimové varování.");
  }
  if (regime.regime === "REGIME_BREAK") {
    trustScore -= 0.4;
    reasons.push("Byl detekován režimový zlom trhu.");
  }
  if (health.status === "INSUFFICIENT_DATA") {
    // Lack of evidence is not evidence of good performance.
    trustScore = Math.min(trustScore, 0.65);
    reasons.push("Pro ověření predikční výkonnosti není dostatek platných výsledků.");
  }
  if (health.status === "DEGRADING") {
    trustScore -= 0.2;
    reasons.push("Predikční chyba se zhoršuje.");
  }
  if (health.status === "BROKEN") {
    trustScore -= 0.45;
    reasons.push("Model má výrazně horší nedávnou predikční výkonnost.");
  }

  trustScore = Math.max(0, Math.min(1, trustScore));
  const action =
    trustScore < 0.25 ? "RETRAIN" :
    trustScore < 0.45 ? "DEMOTE_CHAMPION" :
    trustScore < 0.7 ? "WATCH_CHAMPION" :
    "KEEP_CHAMPION";

  return { trustScore, action, reasons };
}
