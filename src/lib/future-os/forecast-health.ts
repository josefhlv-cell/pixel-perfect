export type ForecastErrorPoint = {
  asOf: string;
  absoluteError: number;
  directionalHit: boolean;
  intervalCovered: boolean;
};

export type ForecastHealth = {
  sampleCount: number;
  recentMae: number;
  historicalMae: number;
  maeRatio: number;
  recentDirectionalAccuracy: number;
  recentCoverage: number;
  status: "HEALTHY" | "DEGRADING" | "BROKEN";
};

export function evaluateForecastHealth(
  history: ForecastErrorPoint[],
  recentWindow = 8,
): ForecastHealth {
  const ordered = [...history].sort((a, b) => +new Date(a.asOf) - +new Date(b.asOf));
  const recent = ordered.slice(-recentWindow);
  const baseline = ordered.slice(0, Math.max(0, ordered.length - recent.length));
  const avg = (rows: ForecastErrorPoint[], field: "absoluteError") =>
    rows.length ? rows.reduce((s, row) => s + row[field], 0) / rows.length : 0;
  const historicalMae = avg(baseline, "absoluteError");
  const recentMae = avg(recent, "absoluteError");
  const maeRatio = historicalMae > 0 ? recentMae / historicalMae : recentMae > 0 ? Infinity : 1;
  const recentDirectionalAccuracy = recent.length
    ? recent.filter((row) => row.directionalHit).length / recent.length
    : 0;
  const recentCoverage = recent.length
    ? recent.filter((row) => row.intervalCovered).length / recent.length
    : 0;
  const status = maeRatio >= 1.75 || recentDirectionalAccuracy < 0.45
    ? "BROKEN"
    : maeRatio >= 1.25 || recentCoverage < 0.75
      ? "DEGRADING"
      : "HEALTHY";
  return {
    sampleCount: ordered.length,
    recentMae,
    historicalMae,
    maeRatio,
    recentDirectionalAccuracy,
    recentCoverage,
    status,
  };
}
