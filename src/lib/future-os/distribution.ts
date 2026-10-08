export type ForecastDistribution = {
  p10: number;
  p25?: number;
  p50: number;
  p75?: number;
  p90: number;
  probabilityPositive: number;
};

export type DistributionComparison = {
  mean: number;
  median: number;
  dispersion: number;
  tailRisk: number;
  skewProxy: number;
  concentration: number;
  interpretation: "BROAD_BASED" | "HETEROGENEOUS" | "TAIL_DRIVEN" | "UNRESOLVED";
};

export function analyzeForecastDistribution(values: number[]): DistributionComparison {
  if (!values.length) {
    return { mean: 0, median: 0, dispersion: 0, tailRisk: 0, skewProxy: 0, concentration: 0, interpretation: "UNRESOLVED" };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((s, x) => s + x, 0) / values.length;
  const median = sorted.length % 2 ? sorted[Math.floor(sorted.length / 2)] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  const q10 = sorted[Math.max(0, Math.floor((sorted.length - 1) * 0.1))];
  const q90 = sorted[Math.max(0, Math.floor((sorted.length - 1) * 0.9))];
  const dispersion = q90 - q10;
  const tailRisk = Math.abs(q10 - median) / Math.max(1, dispersion);
  const skewProxy = ((q90 - median) - (median - q10)) / Math.max(1, dispersion);
  const sameSign = values.filter((x) => Math.sign(x) === Math.sign(median)).length / values.length;
  const concentration = sameSign;
  const interpretation = dispersion > Math.max(5, Math.abs(median) * 2)
    ? "HETEROGENEOUS"
    : tailRisk > 0.65
      ? "TAIL_DRIVEN"
      : concentration > 0.75
        ? "BROAD_BASED"
        : "UNRESOLVED";
  return { mean, median, dispersion, tailRisk, skewProxy, concentration, interpretation };
}
