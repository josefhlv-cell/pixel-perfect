import type { FutureConvergence } from "./future-convergence";
import { convergenceWarningLevel } from "./future-convergence";
import type { TurningPointResult } from "./turning-point-detector";

export type FuturePath = {
  id: string;
  direction: 1 | -1;
  horizonDays: number;
  probability: number;
  mechanisms: string[];
  fragility: number;
};

export type FutureSuperposition = {
  dominant: FuturePath | null;
  paths: FuturePath[];
  entropy: number;
  agreement: number;
  status: "CLEAR" | "CONTESTED" | "DATA_STARVED";
};

/**
 * Treats the future as a probability distribution over competing trajectories.
 *
 * A single winner is not forced when several futures retain comparable support.
 * This is the bridge between causal convergence, turning-point warnings and
 * the model tournament: the product should expose uncertainty in the future
 * itself, not merely uncertainty around one forecast.
 */
export function buildFutureSuperposition(input: {
  convergence: FutureConvergence[];
  turningPoint?: TurningPointResult | null;
  minimumProbability?: number;
}): FutureSuperposition {
  const minimum = input.minimumProbability ?? 0.08;
  const candidates: FuturePath[] = input.convergence.map((item, index) => {
    const warning = convergenceWarningLevel(item);
    const warningBoost =
      warning === "EARLY_WARNING" ? 1.18 :
      warning === "WATCH" ? 1.05 : 0.92;
    const turningBoost =
      input.turningPoint && input.turningPoint.direction === item.direction ? 1.12 : 1;

    return {
      id: `future-${item.direction > 0 ? "up" : "down"}-${index}`,
      direction: item.direction,
      horizonDays: item.medianImpactDays ?? item.earliestImpactDays ?? 0,
      probability: Math.max(
        minimum,
        item.convergenceScore * warningBoost * turningBoost * (1 - item.fragility * 0.35),
      ),
      mechanisms: item.paths.flatMap(path => path.nodes).filter((value, i, all) => all.indexOf(value) === i),
      fragility: item.fragility,
    };
  });

  const total = candidates.reduce((sum, path) => sum + path.probability, 0);
  if (!total) {
    return { dominant: null, paths: [], entropy: 0, agreement: 0, status: "DATA_STARVED" };
  }

  const paths = candidates
    .map(path => ({ ...path, probability: path.probability / total }))
    .filter(path => path.probability >= minimum)
    .sort((a, b) => b.probability - a.probability);

  const entropy = -paths.reduce(
    (sum, path) => sum + path.probability * Math.log2(path.probability),
    0,
  );
  const dominant = paths[0] ?? null;
  const agreement = dominant
    ? paths.filter(path => path.direction === dominant.direction).reduce((sum, path) => sum + path.probability, 0)
    : 0;

  const contested = paths.length > 1 && dominant && paths[1]!.probability >= dominant.probability * 0.7;

  return {
    dominant,
    paths,
    entropy,
    agreement,
    status: contested ? "CONTESTED" : agreement >= 0.7 ? "CLEAR" : "CONTESTED",
  };
}
