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
    return {
      mean: 0,
      median: 0,
      dispersion: 0,
      tailRisk: 0,
      skewProxy: 0,
      concentration: 0,
      interpretation: "UNRESOLVED",
    };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((s, x) => s + x, 0) / values.length;
  const median =
    sorted.length % 2
      ? sorted[Math.floor(sorted.length / 2)]
      : (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2;
  // Linear-interpolated quantiles (floor indexing biased q90 downward on small samples).
  const quantile = (q: number) => {
    const pos = (sorted.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.min(sorted.length - 1, lo + 1);
    return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
  };
  const q10 = quantile(0.1);
  const q90 = quantile(0.9);
  const dispersion = q90! - q10!;
  // Share of the 10–90 range lying below the median: 0.5 = symmetric, >0.75 = downside tail ≥3× upside.
  const tailRisk = dispersion > 0 ? (median! - q10) / dispersion : 0;
  const skewProxy = (q90! - median! - (median! - q10!)) / Math.max(1, dispersion);
  const sameSign = values.filter((x) => Math.sign(x) === Math.sign(median!)).length / values.length;
  const concentration = sameSign;
  const interpretation =
    dispersion > Math.max(5, Math.abs(median!) * 2)
      ? "HETEROGENEOUS"
      : tailRisk > 0.75
        ? "TAIL_DRIVEN"
        : concentration > 0.75
          ? "BROAD_BASED"
          : "UNRESOLVED";
  return { mean, median: median!, dispersion, tailRisk, skewProxy, concentration, interpretation };
}
