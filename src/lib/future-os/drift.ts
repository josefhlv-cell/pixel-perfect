export type DriftMetric = {
  key: string;
  baseline: number[];
  recent: number[];
  threshold: number;
};

export type DriftResult = {
  key: string;
  meanShift: number;
  volatilityRatio: number;
  distributionShift: number;
  driftScore: number;
  status: "STABLE" | "WATCH" | "BREAK";
};

function mean(values: number[]) {
  return values.length ? values.reduce((s, x) => s + x, 0) / values.length : 0;
}

function std(values: number[]) {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((s, x) => s + (x - m) ** 2, 0) / (values.length - 1));
}

function quantile(values: number[], q: number) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const p = (s.length - 1) * q;
  const lo = Math.floor(p);
  const hi = Math.ceil(p);
  return s[lo] + (s[hi] - s[lo]) * (p - lo);
}

export function detectDrift(metric: DriftMetric): DriftResult {
  const baselineMean = mean(metric.baseline);
  const recentMean = mean(metric.recent);
  const baselineVol = std(metric.baseline);
  const recentVol = std(metric.recent);
  const scale = Math.max(metric.threshold, baselineVol, Math.abs(baselineMean) * 0.1, 1e-9);
  const meanShift = Math.abs(recentMean - baselineMean) / scale;
  const volatilityRatio = baselineVol ? recentVol / baselineVol : recentVol;
  const qBase = quantile(metric.baseline, 0.9) - quantile(metric.baseline, 0.1);
  const qRecent = quantile(metric.recent, 0.9) - quantile(metric.recent, 0.1);
  const distributionShift = Math.abs(qRecent - qBase) / Math.max(metric.threshold, qBase, 1e-9);
  const driftScore = Math.min(1, 0.45 * Math.min(1, meanShift) + 0.25 * Math.min(1, Math.abs(volatilityRatio - 1)) + 0.30 * Math.min(1, distributionShift));
  const status = driftScore >= 0.72 ? "BREAK" : driftScore >= 0.42 ? "WATCH" : "STABLE";
  return { key: metric.key, meanShift, volatilityRatio, distributionShift, driftScore, status };
}

export function detectRegimeBreak(metrics: DriftMetric[]) {
  const results = metrics.map(detectDrift);
  const broken = results.filter((r) => r.status === "BREAK").length;
  const watched = results.filter((r) => r.status === "WATCH").length;
  const regime = broken >= 2 ? "REGIME_BREAK" : watched >= 2 ? "REGIME_WARNING" : "STABLE";
  return { regime, results, confidence: Math.min(1, (broken * 0.45 + watched * 0.2) / Math.max(1, metrics.length)) };
}
