export type PredictionRecord = {
  experimentId: string;
  configHash: string;
  codeSha: string;
  dependencyLockHash: string;
  vintageSnapshotHash: string;
  seed: number;
  origin: string;
  region: string;
  asOf: string;
  horizonEnd: string;
  scenarioId: string;
  bottleneckEdgeId: string | null;
  bottleneckStatus: "IDENTIFIED" | "NO_BOTTLENECK";
  scenarioScore: number;
};

export type RealizationRecord = {
  experimentId: string;
  predictionRecordHash: string;
  realizedAt: string;
  targetValue: number;
  targetDirection: -1 | 0 | 1;
};

export type PredictionJournal = {
  appendPrediction(record: PredictionRecord): Promise<string>;
  appendRealization(record: RealizationRecord): Promise<void>;
};

export type PredictionJournalState = "PREDICTION_COMMITTED";

function canonicalPrediction(record: PredictionRecord): string {
  return JSON.stringify({
    experimentId: record.experimentId,
    configHash: record.configHash,
    codeSha: record.codeSha,
    dependencyLockHash: record.dependencyLockHash,
    vintageSnapshotHash: record.vintageSnapshotHash,
    seed: record.seed,
    origin: record.origin,
    region: record.region,
    asOf: record.asOf,
    horizonEnd: record.horizonEnd,
    scenarioId: record.scenarioId,
    bottleneckEdgeId: record.bottleneckEdgeId,
    bottleneckStatus: record.bottleneckStatus,
    scenarioScore: record.scenarioScore,
  });
}

async function hashRecord(record: PredictionRecord): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalPrediction(record));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function assertPredictionRecordComplete(record: PredictionRecord): void {
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined || value === null || value === "") {
      if (key === "bottleneckEdgeId" && value === null) continue;
      throw new Error(`Incomplete prediction record: ${key}`);
    }
  }
  if (!Number.isFinite(record.scenarioScore)) {
    throw new Error("Prediction scenarioScore must be finite.");
  }
}

export function predictionKey(record: PredictionRecord): string {
  return [
    record.experimentId,
    record.region,
    record.origin,
    record.asOf,
    record.scenarioId,
    record.bottleneckEdgeId ?? "NO_BOTTLENECK",
  ].join("|");
}

export function assertRevealAllowed(
  state: PredictionJournalState,
): void {
  if (state !== "PREDICTION_COMMITTED") {
    throw new Error("Realization cannot be appended before prediction commitment.");
  }
}

export class InMemoryPredictionJournal implements PredictionJournal {
  readonly predictions: PredictionRecord[] = [];
  readonly realizations: RealizationRecord[] = [];
  private readonly hashes = new Map<string, string>();
  private readonly committedHashes = new Set<string>();

  async appendPrediction(record: PredictionRecord): Promise<string> {
    assertPredictionRecordComplete(record);
    const key = predictionKey(record);
    if (this.hashes.has(key)) {
      throw new Error(`Duplicate prediction: ${key}`);
    }
    const hash = await hashRecord(record);
    this.predictions.push(structuredClone(record));
    this.hashes.set(key, hash);
    this.committedHashes.add(hash);
    return hash;
  }

  async appendRealization(record: RealizationRecord): Promise<void> {
    if (!this.committedHashes.has(record.predictionRecordHash)) {
      throw new Error("Realization references an unknown prediction hash.");
    }
    if (!Number.isFinite(record.targetValue)) {
      throw new Error("Realization targetValue must be finite.");
    }
    this.realizations.push(structuredClone(record));
  }
}
