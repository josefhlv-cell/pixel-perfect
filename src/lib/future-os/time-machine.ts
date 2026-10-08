import { getEvidenceAvailableAt, assertNoFutureEvidence } from "./point-in-time";
import type { EvidenceObservation } from "./types";

export type TimeMachineCheckpoint = {
  asOf: string;
  horizonDays: number;
  evidence: EvidenceObservation[];
  evidenceIds: string[];
};

export type TimeMachineRun = {
  checkpoints: TimeMachineCheckpoint[];
  leakageDetected: boolean;
  leakageIds: string[];
};

export function buildTimeMachineCheckpoints(
  observations: EvidenceObservation[],
  asOfDates: string[],
  horizonsDays: number[] = [90, 180, 365, 730],
): TimeMachineRun {
  const checkpoints: TimeMachineCheckpoint[] = [];
  const leakageIds = new Set<string>();

  for (const asOf of asOfDates) {
    const evidence = getEvidenceAvailableAt(observations, asOf);
    try {
      assertNoFutureEvidence(evidence, asOf);
    } catch {
      evidence.forEach((row) => {
        if (+new Date(row.availableAt) > +new Date(asOf)) leakageIds.add(row.id);
      });
    }

    for (const horizonDays of horizonsDays) {
      checkpoints.push({
        asOf,
        horizonDays,
        evidence,
        evidenceIds: evidence.map((row) => row.id),
      });
    }
  }

  return {
    checkpoints,
    leakageDetected: leakageIds.size > 0,
    leakageIds: [...leakageIds],
  };
}

export function buildWalkForwardDates(
  start: string,
  end: string,
  stepDays = 90,
): string[] {
  const startMs = +new Date(start);
  const endMs = +new Date(end);
  const stepMs = stepDays * 86_400_000;
  const dates: string[] = [];
  for (let cursor = startMs; cursor <= endMs; cursor += stepMs) {
    dates.push(new Date(cursor).toISOString());
  }
  return dates;
}
