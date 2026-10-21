export type ForecastModelId = "ZERO" | "PERSIST" | "AR1" | "RATE_LAG";

export type DistributionForecast = {
  modelId: ForecastModelId;
  p10: number;
  p50: number;
  p90: number;
  probabilityPositive: number;
  trainingPairs: number;
  residualScale: number;
};

export type TrainingPair = {
  lagReturn: number;
  futureReturn: number;
  rateDelta: number | null;
};

const MIN_PAIRS = 8;

export function fitModels(
  pairs: readonly TrainingPair[],
  lagReturnNow: number,
  rateDeltaNow: number | null,
): DistributionForecast[] {
  if (pairs.length < MIN_PAIRS) return [];
  if (!Number.isFinite(lagReturnNow)) throw new Error("Current lag return must be finite.");
  const forecasts: DistributionForecast[] = [
    fromPoint(
      "ZERO",
      0,
      pairs.map((pair) => pair.futureReturn),
    ),
    fromPoint(
      "PERSIST",
      lagReturnNow,
      pairs.map((pair) => pair.futureReturn - pair.lagReturn),
    ),
  ];

  const ar = fitLine(
    pairs.map((pair) => pair.lagReturn),
    pairs.map((pair) => pair.futureReturn),
  );
  if (ar) {
    const point = ar.a + ar.b * lagReturnNow;
    forecasts.push(
      fromPoint(
        "AR1",
        point,
        pairs.map((pair) => pair.futureReturn - (ar.a + ar.b * pair.lagReturn)),
      ),
    );
  }

  if (rateDeltaNow != null && pairs.every((pair) => pair.rateDelta != null)) {
    const rate = fitRateLag(pairs);
    if (rate) {
      const point = rate.a + rate.b * lagReturnNow + rate.c * rateDeltaNow;
      forecasts.push(
        fromPoint(
          "RATE_LAG",
          point,
          pairs.map(
            (pair) =>
              pair.futureReturn -
              (rate.a + rate.b * pair.lagReturn + rate.c * (pair.rateDelta as number)),
          ),
        ),
      );
    }
  }
  return forecasts;
}

export function trainingPairs(
  levels: readonly number[],
  origin: number,
  horizon: number,
  rateDeltas: readonly (number | null)[],
): TrainingPair[] {
  const pairs: TrainingPair[] = [];
  for (let k = horizon; k + horizon <= origin; k += 1) {
    pairs.push({
      lagReturn: numAt(levels, k) - numAt(levels, k - horizon),
      futureReturn: numAt(levels, k + horizon) - numAt(levels, k),
      rateDelta: rateDeltas[k] ?? null,
    });
  }
  return pairs;
}

function fromPoint(
  modelId: ForecastModelId,
  point: number,
  residuals: number[],
): DistributionForecast {
  if (
    !residuals.length ||
    residuals.some((value) => !Number.isFinite(value)) ||
    !Number.isFinite(point)
  ) {
    throw new Error(`Non-finite ${modelId} forecast.`);
  }
  const sorted = [...residuals].sort((a, b) => a - b);
  const p50 = point;
  const p10 = Math.min(p50, p50 + quantile(sorted, 0.1));
  const p90 = Math.max(p50, p50 + quantile(sorted, 0.9));
  const hits = residuals.filter((residual) => p50 + residual > 0).length / residuals.length;
  return {
    modelId,
    p10,
    p50,
    p90,
    probabilityPositive: clampProbability(hits),
    trainingPairs: residuals.length,
    residualScale: residuals.reduce((sum, value) => sum + Math.abs(value), 0) / residuals.length,
  };
}

function fitLine(xs: number[], ys: number[]): { a: number; b: number } | null {
  if (xs.length !== ys.length || xs.length < MIN_PAIRS) return null;
  const n = xs.length;
  let meanX = 0;
  let meanY = 0;
  for (let i = 0; i < n; i += 1) {
    meanX += numAt(xs, i);
    meanY += numAt(ys, i);
  }
  meanX /= n;
  meanY /= n;
  let varX = 0;
  let cov = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = numAt(xs, i) - meanX;
    varX += dx * dx;
    cov += dx * (numAt(ys, i) - meanY);
  }
  if (varX <= 1e-18) return { a: meanY, b: 0 };
  const b = cov / varX;
  return { a: meanY - b * meanX, b };
}

function fitRateLag(pairs: readonly TrainingPair[]): { a: number; b: number; c: number } | null {
  const n = pairs.length;
  if (n < MIN_PAIRS) return null;
  const xtx = [
    [n, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const xty = [0, 0, 0];
  for (const pair of pairs) {
    const z = pair.rateDelta;
    if (z == null || !Number.isFinite(z)) return null;
    const row = [1, pair.lagReturn, z];
    for (let r = 0; r < 3; r += 1) {
      const coefficient = numAt(row, r);
      xty[r] = numAt(xty, r) + coefficient * pair.futureReturn;
      const matrixRow = xtx[r];
      if (!matrixRow) throw new Error("Rate lag matrix is incomplete.");
      for (let c = 0; c < 3; c += 1) {
        matrixRow[c] = numAt(matrixRow, c) + coefficient * numAt(row, c);
      }
    }
  }
  const beta = solve3(xtx, xty);
  if (!beta) return null;
  return { a: numAt(beta, 0), b: numAt(beta, 1), c: numAt(beta, 2) };
}

function solve3(matrix: number[][], target: number[]): number[] | null {
  const rows = matrix.map((row, index) => [...row, numAt(target, index)]);
  for (let col = 0; col < 3; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < 3; row += 1) {
      const candidate = rows[row];
      const pivotRow = rows[pivot];
      if (!candidate || !pivotRow) return null;
      if (Math.abs(numAt(candidate, col)) > Math.abs(numAt(pivotRow, col))) pivot = row;
    }
    const pivotRow = rows[pivot];
    const current = rows[col];
    if (!pivotRow || !current || Math.abs(numAt(pivotRow, col)) < 1e-12) return null;
    rows[col] = pivotRow;
    rows[pivot] = current;
    const scale = numAt(rows[col] ?? [], col);
    const scaled = rows[col];
    if (!scaled) return null;
    for (let c = col; c < 4; c += 1) scaled[c] = numAt(scaled, c) / scale;
    for (let row = 0; row < 3; row += 1) {
      if (row === col) continue;
      const targetRow = rows[row];
      if (!targetRow) return null;
      const factor = numAt(targetRow, col);
      for (let c = col; c < 4; c += 1) {
        targetRow[c] = numAt(targetRow, c) - factor * numAt(scaled, c);
      }
    }
  }
  const solved = [rows[0], rows[1], rows[2]];
  if (solved.some((row) => !row)) return null;
  return solved.map((row) => numAt(row ?? [], 3));
}

function quantile(sorted: readonly number[], p: number): number {
  const pos = (sorted.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return numAt(sorted, lo);
  const weight = pos - lo;
  return numAt(sorted, lo) * (1 - weight) + numAt(sorted, hi) * weight;
}

function numAt(values: readonly number[], index: number): number {
  const value = values[index];
  if (value == null || !Number.isFinite(value))
    throw new Error(`Missing finite value at index ${index}.`);
  return value;
}

function clampProbability(value: number): number {
  return Math.min(1 - 1e-6, Math.max(1e-6, value));
}
