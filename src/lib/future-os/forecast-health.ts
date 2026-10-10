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
  status: "INSUFFICIENT_DATA" | "HEALTHY" | "DEGRADING" | "BROKEN";
};

const MIN_RECENT_SAMPLES = 4;
const MIN_BASELINE_SAMPLES = 4;

export function evaluateForecastHealth(
  history: ForecastErrorPoint[],
  recentWindow = 8,
): ForecastHealth {
  // Invalid records must not silently make the model look healthy.
  const ordered = history
    .filter((row) =>
      Number.isFinite(Date.parse(row.asOf)) &&
      Number.isFinite(row.absoluteError) &&
      row.absoluteError >= 0 &&
      typeof row.directionalHit === "boolean" &&
      typeof row.intervalCovered === "boolean"
    )
    .slice()
    .sort((a, b) => Date.parse(a.asOf) - Date.parse(b.asOf));

  const safeWindow = Number.isFinite(recentWindow)
    ? Math.floor(recentWindow)
    : 0;
  const recent = safeWindow > 0 ? ordered.slice(-safeWindow) : [];
  const baseline = ordered.slice(0, Math.max(0, ordered.length - recent.length));
  const avg = (rows: ForecastErrorPoint[]) =>
    rows.length ? rows.reduce((sum, row) => sum + row.absoluteError, 0) / rows.length : 0;
  const historicalMae = avg(baseline);
  const recentMae = avg(recent);
  const maeRatio =
    historicalMae > 0 ? recentMae / historicalMae : recentMae > 0 ? Infinity : 1;
  const recentDirectionalAccuracy = recent.length
    ? recent.filter((row) => row.directionalHit).length / recent.length
    : 0;
  const recentCoverage = recent.length
    ? recent.filter((row) => row.intervalCovered).length / recent.length
    : 0;

  // No performance label without both a recent sample and a historical comparator.
  const enoughData =
    safeWindow > 0 &&
    recent.length >= MIN_RECENT_SAMPLES &&
    baseline.length >= MIN_BASELINE_SAMPLES;
  const status: ForecastHealth["status"] = !enoughData
    ? "INSUFFICIENT_DATA"
    : maeRatio >= 1.75 || recentDirectionalAccuracy < 0.45
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
