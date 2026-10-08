import type { ExperimentConfig } from "./experiment-config";
import type { VintageObservation } from "./vintage/types";

export function assertNoLookAhead(
  observations: VintageObservation[],
  asOf: string,
): void {
  const cutoff = new Date(asOf).getTime();
  if (!Number.isFinite(cutoff)) throw new Error("Invalid asOf date.");

  const leaked = observations.find(
    (row) => new Date(row.vintageDate).getTime() > cutoff,
  );
  if (leaked) {
    throw new Error(
      `Look-ahead leakage detected: ${leaked.region}/${leaked.series} vintage=${leaked.vintageDate} cutoff=${new Date(cutoff).toISOString()}`,
    );
  }
}

export function canonicalizeConfig(config: ExperimentConfig): string {
  return JSON.stringify({
    version: config.version,
    horizonMonths: config.horizonMonths,
    embargoMonths: config.embargoMonths,
    epsilon: config.epsilon,
    delta: config.delta,
    attacks: [...config.attacks],
    minimumRegions: config.minimumRegions,
    minimumWalkForwardWindows: config.minimumWalkForwardWindows,
    blockBootstrapMonths: config.blockBootstrapMonths,
    scoreAlpha: config.scoreAlpha,
    scoreBeta: config.scoreBeta,
    informationScaleSource: config.informationScaleSource,
    vintagePolicy: config.vintagePolicy,
    trajectory: {
      nodeIds: [...config.trajectory.nodeIds],
      edgeIds: [...config.trajectory.edgeIds],
      pathSurvivalAggregation: config.trajectory.pathSurvivalAggregation,
    },
  });
}

export async function hashExperimentConfig(
  config: ExperimentConfig,
): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalizeConfig(config));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
