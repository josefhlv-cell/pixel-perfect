export type PredictiveComparison = {
  baselineLoss: number;
  candidateLoss: number;
  sampleCount: number;
  improvement: number;
  stability: number;
  incrementalValue: number;
  status: "USEFUL" | "MARGINAL" | "REJECT";
};

export function evaluateIncrementalPredictiveValue(
  baselineLosses: number[],
  candidateLosses: number[],
  windows = 4,
): PredictiveComparison {
  const n = Math.min(baselineLosses.length, candidateLosses.length);
  if (n < 10) {
    return { baselineLoss: 0, candidateLoss: 0, sampleCount: n, improvement: 0, stability: 0, incrementalValue: 0, status: "REJECT" };
  }

  const base = baselineLosses.slice(0, n);
  const cand = candidateLosses.slice(0, n);
  const baselineLoss = base.reduce((s, x) => s + x, 0) / n;
  const candidateLoss = cand.reduce((s, x) => s + x, 0) / n;
  const improvement = baselineLoss > 0 ? (baselineLoss - candidateLoss) / baselineLoss : 0;

  const chunkSize = Math.max(1, Math.floor(n / windows));
  const improvements: number[] = [];
  for (let start = 0; start < n; start += chunkSize) {
    const end = Math.min(n, start + chunkSize);
    const b = base.slice(start, end);
    const c = cand.slice(start, end);
    if (!b.length) continue;
    const bm = b.reduce((s, x) => s + x, 0) / b.length;
    const cm = c.reduce((s, x) => s + x, 0) / c.length;
    improvements.push(bm > 0 ? (bm - cm) / bm : 0);
  }

  const positiveWindows = improvements.filter((x) => x > 0).length / Math.max(1, improvements.length);
  const stability = improvements.length
    ? positiveWindows * (1 - Math.min(1, Math.abs(Math.max(...improvements) - Math.min(...improvements))))
    : 0;
  const incrementalValue = Math.max(0, improvement) * (0.5 + 0.5 * stability);

  const status = incrementalValue >= 0.10 && stability >= 0.5
    ? "USEFUL"
    : incrementalValue >= 0.03
      ? "MARGINAL"
      : "REJECT";

  return { baselineLoss, candidateLoss, sampleCount: n, improvement, stability, incrementalValue, status };
}
