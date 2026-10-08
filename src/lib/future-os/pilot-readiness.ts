import { DEFAULT_EXPERIMENT_CONFIG, PREREGISTERED_PILOT_SPLIT } from "./experiment-config";
import { PRIMARY_H2_VINTAGE_AUDIT, validateVintageAudit } from "./vintage/audit";

export type ReadinessGate = {
  id: string;
  status: "PASS" | "BLOCKED" | "WARNING";
  detail: string;
};

export type PilotReadiness = {
  status: "READY_FOR_DATA_COLLECTION" | "BLOCKED";
  gates: readonly ReadinessGate[];
  blockers: readonly string[];
};

/**
 * Explicit go/no-go checklist. A passing checklist means the experiment may
 * collect and validate data; it does not mean the data exists or the model is
 * predictive.
 */
export function assessPilotReadiness(input: {
  sourceAdaptersVerified: boolean;
  pointInTimeSnapshotsAvailable: boolean;
  baselineImplementationsAvailable: boolean;
  localTestsPassed: boolean;
}): PilotReadiness {
  const gates: ReadinessGate[] = [];
  const add = (id: string, pass: boolean, detail: string) => {
    gates.push({ id, status: pass ? "PASS" : "BLOCKED", detail });
  };

  let strictVintagePass = true;
  try {
    validateVintageAudit(PRIMARY_H2_VINTAGE_AUDIT, true);
  } catch {
    strictVintagePass = false;
  }

  add("STRICT_VINTAGE_AUDIT", strictVintagePass, strictVintagePass
    ? "All primary series have verified vintage and publication-lag metadata."
    : "Primary H2 series still contain assumed lags and pending source verification.");
  add("SOURCE_ADAPTERS", input.sourceAdaptersVerified, "Adapters must be tested against source documentation and real response payloads.");
  add("POINT_IN_TIME_SNAPSHOTS", input.pointInTimeSnapshotsAvailable, "Historical values must reflect what was available at each forecast origin.");
  add("BASELINES", input.baselineImplementationsAvailable, "Naive and statistical baselines must run on the identical folds.");
  add("LOCAL_TESTS", input.localTestsPassed, "Unit and integration tests must pass in the project runtime.");

  const blockers = gates.filter((gate) => gate.status === "BLOCKED").map((gate) => `${gate.id}: ${gate.detail}`);
  if (DEFAULT_EXPERIMENT_CONFIG.vintagePolicy !== "STRICT") {
    blockers.push("EXPERIMENT_POLICY: preregistered pilot must retain strict vintage policy.");
  }

  return {
    status: blockers.length ? "BLOCKED" : "READY_FOR_DATA_COLLECTION",
    gates,
    blockers,
  };
}

export function getPilotDesignSummary() {
  return {
    frequency: PREREGISTERED_PILOT_SPLIT.frequency,
    training: [PREREGISTERED_PILOT_SPLIT.trainingStart, PREREGISTERED_PILOT_SPLIT.trainingEnd],
    holdout: [PREREGISTERED_PILOT_SPLIT.holdoutStart, PREREGISTERED_PILOT_SPLIT.holdoutEnd],
    regions: [...PREREGISTERED_PILOT_SPLIT.regions],
    horizonMonths: DEFAULT_EXPERIMENT_CONFIG.horizonMonths,
    embargoMonths: DEFAULT_EXPERIMENT_CONFIG.embargoMonths,
    minimumRegions: DEFAULT_EXPERIMENT_CONFIG.minimumRegions,
    minimumWalkForwardWindows: DEFAULT_EXPERIMENT_CONFIG.minimumWalkForwardWindows,
    vintagePolicy: DEFAULT_EXPERIMENT_CONFIG.vintagePolicy,
  } as const;
}
