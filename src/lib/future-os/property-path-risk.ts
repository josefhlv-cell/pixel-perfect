import type { PropertyTrajectoryPoint } from "./property-trajectory";

export function analyzePropertyPathRisk(points: PropertyTrajectoryPoint[]) {
  if (!points.length) return {
    maxDrawdown: 0,
    minimumLiquidity: 0,
    minimumEquity: 0,
    recoveryMonth: null as number | null,
    pathRisk: 1,
  };
  const initialValue = points[0]!.propertyValue;
  let peak = initialValue;
  let maxDrawdown = 0;
  let recoveryMonth: number | null = null;
  for (const point of points) {
    peak = Math.max(peak, point.propertyValue);
    const drawdown = peak > 0 ? (peak - point.propertyValue) / peak : 0;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
    if (recoveryMonth == null && point.propertyValue >= initialValue) recoveryMonth = point.month;
  }
  const minimumLiquidity = Math.min(...points.map((p) => p.liquidityScore));
  const minimumEquity = Math.min(...points.map((p) => p.equity));
  const pathRisk = Math.min(1, 0.55 * maxDrawdown + 0.30 * (1 - minimumLiquidity) + 0.15 * (minimumEquity < 0 ? 1 : 0));
  return { maxDrawdown, minimumLiquidity, minimumEquity, recoveryMonth, pathRisk };
}
