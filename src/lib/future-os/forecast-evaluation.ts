export type ForecastEvaluationSample = {
  actual: number;
  baselineActual: number;
  candidate: { p50: number; probabilityPositive: number };
  benchmark: { p50: number; probabilityPositive: number };
};

export type PairedMetric = "MAE" | "BRIER" | "LOG_LOSS" | "DIRECTIONAL_ERROR";

function validateSamples(samples: ForecastEvaluationSample[]): void {
  for (const [index, sample] of samples.entries()) {
    for (const [name, value] of [
      ["actual", sample.actual],
      ["baselineActual", sample.baselineActual],
      ["candidate.p50", sample.candidate?.p50],
      ["benchmark.p50", sample.benchmark?.p50],
      ["candidate.probabilityPositive", sample.candidate?.probabilityPositive],
      ["benchmark.probabilityPositive", sample.benchmark?.probabilityPositive],
    ] as const) {
      if (!Number.isFinite(value)) {
        throw new RangeError(`Invalid evaluation sample at index ${index}: ${name} must be finite`);
      }
    }
    for (const [name, probability] of [
      ["candidate.probabilityPositive", sample.candidate.probabilityPositive],
      ["benchmark.probabilityPositive", sample.benchmark.probabilityPositive],
    ] as const) {
      if (probability < 0 || probability > 1) {
        throw new RangeError(`Invalid evaluation sample at index ${index}: ${name} must be between 0 and 1`);
      }
    }
  }
}

function metric(s: ForecastEvaluationSample, side: "candidate" | "benchmark", kind: PairedMetric) {
  const f = s[side];
  const actualChange = s.actual - s.baselineActual;
  const predictedChange = f.p50 - s.baselineActual;
  if (kind === "MAE") return Math.abs(f.p50 - s.actual);
  const p = Math.min(1 - 1e-12, Math.max(1e-12, f.probabilityPositive));
  const y = actualChange > 0 ? 1 : 0;
  if (kind === "BRIER") return (p - y) ** 2;
  if (kind === "LOG_LOSS") return -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
  // A zero predicted move is not evidence of a correct directional call.
  const predictedDirection = Math.sign(predictedChange);
  const actualDirection = Math.sign(actualChange);
  return predictedDirection !== 0 && predictedDirection === actualDirection ? 0 : 1;
}

/** Paired circular block bootstrap; lower losses are better. */
export function compareForecastToBenchmark(
  samples: ForecastEvaluationSample[],
  kind: PairedMetric,
  blockLength = 4,
  iterations = 1000,
) {
  if (!["MAE", "BRIER", "LOG_LOSS", "DIRECTIONAL_ERROR"].includes(kind)) {
    throw new RangeError("kind must be a supported paired metric");
  }
  if (samples.length < 20) return null;
  if (!Number.isInteger(iterations) || iterations < 100) {
    throw new RangeError("iterations must be an integer >= 100");
  }
  if (!Number.isInteger(blockLength) || blockLength < 1) {
    throw new RangeError("blockLength must be an integer >= 1");
  }
  validateSamples(samples);

  const deltas = samples.map(s => metric(s, "candidate", kind) - metric(s, "benchmark", kind));
  const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  let state = 0x9e3779b9;
  const random = () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >>> 17; state >>>= 0;
    state ^= state << 5; state >>>= 0;
    return state / 0x100000000;
  };
  const means: number[] = [];
  const block = Math.max(1, Math.min(Math.floor(blockLength), deltas.length));
  for (let k = 0; k < iterations; k++) {
    let sum = 0;
    let count = 0;
    while (count < deltas.length) {
      const start = Math.floor(random() * deltas.length);
      const take = Math.min(block, deltas.length - count);
      for (let j = 0; j < take; j++) sum += deltas[(start + j) % deltas.length]!;
      count += take;
    }
    means.push(sum / deltas.length);
  }
  means.sort((a, b) => a - b);
  const q = (p: number) => means[Math.floor((means.length - 1) * p)]!;
  const low = q(0.025);
  const high = q(0.975);
  return {
    metric: kind,
    candidateMean: samples.reduce((a, s) => a + metric(s, "candidate", kind), 0) / samples.length,
    benchmarkMean: samples.reduce((a, s) => a + metric(s, "benchmark", kind), 0) / samples.length,
    improvement: -mean,
    confidenceLow: -high,
    confidenceHigh: -low,
    significant: high < 0,
    bootstrapSamples: iterations,
  };
}
