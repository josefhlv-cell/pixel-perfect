import { readNumericEvidenceValue } from "./numeric-value";
import type { EvidenceObservation } from "./types";

export type LevelForecastModel = "naive_last" | "drift";

export type LevelPoint = { date: string; value: number };

export type WalkForwardScore = {
  model: LevelForecastModel;
  sampleCount: number;
  mae: number | null;
  rmse: number | null;
  directionalAccuracy: number | null;
};

export type ModelSelection = {
  selected: LevelForecastModel;
  reason: string;
  train: Record<LevelForecastModel, WalkForwardScore>;
  test: Record<LevelForecastModel, WalkForwardScore>;
};

type Origin = { previous: number; actual: number; naive: number; drift: number };

const DEFAULTS = {
  minTrain: 8,
  driftWindow: 6,
  minRelativeImprovement: 0.03,
  trainFraction: 0.6,
  minSlice: 4,
};

function driftForecast(history: number[], window: number): number {
  const last = history[history.length - 1]!;
  const n = Math.min(window, history.length - 1);
  if (n < 1) return last;
  let sum = 0;
  for (let i = history.length - n; i < history.length; i++) sum += history[i]! - history[i - 1]!;
  return last + sum / n;
}

function originsFromValues(values: number[], minTrain: number, driftWindow: number): Origin[] {
  const origins: Origin[] = [];
  for (let i = minTrain; i < values.length; i++) {
    const history = values.slice(0, i);
    const previous = history[history.length - 1]!;
    origins.push({
      previous,
      actual: values[i]!,
      naive: previous,
      drift: driftForecast(history, driftWindow),
    });
  }
  return origins;
}

function scoreOrigins(model: LevelForecastModel, origins: Origin[]): WalkForwardScore {
  if (origins.length === 0) {
    return { model, sampleCount: 0, mae: null, rmse: null, directionalAccuracy: null };
  }
  let abs = 0;
  let sq = 0;
  let hits = 0;
  let comparable = 0;
  for (const origin of origins) {
    const predicted = model === "naive_last" ? origin.naive : origin.drift;
    const error = predicted - origin.actual;
    abs += Math.abs(error);
    sq += error * error;
    const predictedChange = predicted - origin.previous;
    const actualChange = origin.actual - origin.previous;
    const ps = Math.sign(predictedChange);
    const as = Math.sign(actualChange);
    if (ps === 0 || as === 0) continue;
    comparable++;
    if (ps === as) hits++;
  }
  return {
    model,
    sampleCount: origins.length,
    mae: abs / origins.length,
    rmse: Math.sqrt(sq / origins.length),
    directionalAccuracy: comparable ? hits / comparable : null,
  };
}

function chooseModel(
  trainNaive: WalkForwardScore,
  trainDrift: WalkForwardScore,
  allowDrift: boolean,
  minRelativeImprovement: number,
): { selected: LevelForecastModel; reason: string } {
  if (!allowDrift) return { selected: "naive_last", reason: "drift disabled" };
  if (
    trainNaive.mae == null ||
    trainDrift.mae == null ||
    trainNaive.sampleCount < DEFAULTS.minSlice ||
    trainDrift.sampleCount < DEFAULTS.minSlice
  ) {
    return { selected: "naive_last", reason: "train sample below minimum" };
  }
  if (trainNaive.mae === 0)
    return { selected: "naive_last", reason: "naive train error is already zero" };
  const improvement = (trainNaive.mae - trainDrift.mae) / trainNaive.mae;
  if (improvement >= minRelativeImprovement) {
    return {
      selected: "drift",
      reason: `train MAE improved by ${(improvement * 100).toFixed(1)}% versus naive last value`,
    };
  }
  return {
    selected: "naive_last",
    reason: `train MAE improvement ${(improvement * 100).toFixed(1)}% is below ${(minRelativeImprovement * 100).toFixed(1)}%`,
  };
}

/** One-step walk-forward on a caller-aligned series. Does not invent a vintage. */
export function selectLevelModel(
  series: LevelPoint[],
  options?: {
    minTrain?: number;
    driftWindow?: number;
    minRelativeImprovement?: number;
    trainFraction?: number;
    allowDrift?: boolean;
  },
): ModelSelection & { status: "SCORED" | "INSUFFICIENT_ORIGINS" } {
  const minTrain = options?.minTrain ?? DEFAULTS.minTrain;
  const driftWindow = options?.driftWindow ?? DEFAULTS.driftWindow;
  const minRelativeImprovement = options?.minRelativeImprovement ?? DEFAULTS.minRelativeImprovement;
  const trainFraction = options?.trainFraction ?? DEFAULTS.trainFraction;
  const allowDrift = options?.allowDrift ?? true;
  const origins = originsFromValues(
    series.map((point) => point.value),
    minTrain,
    driftWindow,
  );
  const cut = Math.min(
    Math.max(DEFAULTS.minSlice, Math.floor(origins.length * trainFraction)),
    Math.max(0, origins.length - DEFAULTS.minSlice),
  );
  const train = origins.slice(0, cut);
  const test = origins.slice(cut);
  const empty = (model: LevelForecastModel): WalkForwardScore => ({
    model,
    sampleCount: 0,
    mae: null,
    rmse: null,
    directionalAccuracy: null,
  });
  if (train.length < DEFAULTS.minSlice || test.length < DEFAULTS.minSlice) {
    const naive = empty("naive_last");
    const drift = empty("drift");
    return {
      status: "INSUFFICIENT_ORIGINS",
      selected: "naive_last",
      reason: "not enough one-step origins for a held-out comparison",
      train: { naive_last: naive, drift },
      test: { naive_last: naive, drift },
    };
  }
  const trainScores = {
    naive_last: scoreOrigins("naive_last", train),
    drift: scoreOrigins("drift", train),
  };
  const testScores = {
    naive_last: scoreOrigins("naive_last", test),
    drift: scoreOrigins("drift", test),
  };
  const choice = chooseModel(
    trainScores.naive_last,
    trainScores.drift,
    allowDrift,
    minRelativeImprovement,
  );
  return { status: "SCORED", ...choice, train: trainScores, test: testScores };
}

type Release = { period: string; availableAtMs: number; value: number; revision: number };

function entityMatches(row: EvidenceObservation, entityRef: string): boolean {
  const splitAt = entityRef.indexOf(":");
  if (splitAt <= 0) return false;
  return (
    row.entityType === entityRef.slice(0, splitAt) && row.entityKey === entityRef.slice(splitAt + 1)
  );
}

function releasesFor(rows: EvidenceObservation[], entityRef: string): Release[] {
  const releases: Release[] = [];
  for (const row of rows) {
    if (!entityMatches(row, entityRef)) continue;
    const period = row.effectiveFrom ?? row.observedAt;
    const value = readNumericEvidenceValue(row.value);
    const availableAtMs = +new Date(row.availableAt);
    if (!period || value == null || !Number.isFinite(availableAtMs)) continue;
    releases.push({ period, availableAtMs, value, revision: row.revision });
  }
  return releases;
}

export type EvidenceBacktest = {
  status: "BLOCKED_EMPTY" | "BLOCKED_SINGLE_VINTAGE" | "INSUFFICIENT_ORIGINS" | "SCORED";
  reason: string;
  entityRef: string;
  distinctAvailableAt: number;
  selected: LevelForecastModel | null;
  train: Record<LevelForecastModel, WalkForwardScore> | null;
  test: Record<LevelForecastModel, WalkForwardScore> | null;
};

/**
 * Historical skill is identifiable only when releases have different availability times.
 * A batch import that stamps every historical row with one retrieved_at cannot be used
 * as a backtest: the cutoff would either see nothing or the entire revised history.
 * Realized labels are first releases. Features use only vintages available strictly earlier.
 */
export function backtestEvidenceSeries(
  rows: EvidenceObservation[],
  entityRef: string,
  options?: {
    minTrain?: number;
    driftWindow?: number;
    minRelativeImprovement?: number;
    trainFraction?: number;
    allowDrift?: boolean;
  },
): EvidenceBacktest {
  const minTrain = options?.minTrain ?? DEFAULTS.minTrain;
  const driftWindow = options?.driftWindow ?? DEFAULTS.driftWindow;
  const releases = releasesFor(rows, entityRef);
  const distinct = new Set(releases.map((release) => release.availableAtMs));
  const base = {
    entityRef,
    distinctAvailableAt: distinct.size,
    selected: null,
    train: null,
    test: null,
  };
  if (releases.length === 0) {
    return { ...base, status: "BLOCKED_EMPTY", reason: "no numeric releases for this series" };
  }
  if (distinct.size < 2) {
    return {
      ...base,
      status: "BLOCKED_SINGLE_VINTAGE",
      reason:
        "all releases share one availability timestamp, so a historical cutoff cannot be reconstructed",
    };
  }

  const byPeriod = new Map<string, Release[]>();
  for (const release of releases) {
    const list = byPeriod.get(release.period) ?? [];
    list.push(release);
    byPeriod.set(release.period, list);
  }
  const periods = [...byPeriod.keys()].sort();
  const firstRelease = (period: string) =>
    byPeriod.get(period)!.reduce((best, release) => {
      if (release.availableAtMs < best.availableAtMs) return release;
      if (release.availableAtMs === best.availableAtMs && release.revision < best.revision) {
        return release;
      }
      return best;
    });
  const vintageAt = (period: string, cutoffMs: number) => {
    let best: Release | null = null;
    for (const release of byPeriod.get(period)!) {
      if (release.availableAtMs >= cutoffMs) continue;
      if (
        !best ||
        release.availableAtMs > best.availableAtMs ||
        (release.availableAtMs === best.availableAtMs && release.revision > best.revision)
      ) {
        best = release;
      }
    }
    return best;
  };

  const origins: Origin[] = [];
  for (const period of periods) {
    const target = firstRelease(period);
    const history: number[] = [];
    for (const earlier of periods) {
      if (earlier >= period) break;
      const known = vintageAt(earlier, target.availableAtMs);
      if (known) history.push(known.value);
    }
    if (history.length < minTrain) continue;
    const previous = history[history.length - 1]!;
    origins.push({
      previous,
      actual: target.value,
      naive: previous,
      drift: driftForecast(history, driftWindow),
    });
  }

  const trainFraction = options?.trainFraction ?? DEFAULTS.trainFraction;
  const cut = Math.min(
    Math.max(DEFAULTS.minSlice, Math.floor(origins.length * trainFraction)),
    Math.max(0, origins.length - DEFAULTS.minSlice),
  );
  const train = origins.slice(0, cut);
  const test = origins.slice(cut);
  if (train.length < DEFAULTS.minSlice || test.length < DEFAULTS.minSlice) {
    return {
      ...base,
      status: "INSUFFICIENT_ORIGINS",
      reason: "not enough point-in-time origins for a held-out comparison",
    };
  }
  const trainScores = {
    naive_last: scoreOrigins("naive_last", train),
    drift: scoreOrigins("drift", train),
  };
  const testScores = {
    naive_last: scoreOrigins("naive_last", test),
    drift: scoreOrigins("drift", test),
  };
  const choice = chooseModel(
    trainScores.naive_last,
    trainScores.drift,
    options?.allowDrift ?? true,
    options?.minRelativeImprovement ?? DEFAULTS.minRelativeImprovement,
  );
  return {
    status: "SCORED",
    reason: choice.reason,
    entityRef,
    distinctAvailableAt: distinct.size,
    selected: choice.selected,
    train: trainScores,
    test: testScores,
  };
}
