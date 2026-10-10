export type TurningPointPoint = {
  date: string;
  value: number;
};

export type TurningPointSignal = {
  key: string;
  points: TurningPointPoint[];
  weight?: number;
};

export type TurningPointResult = {
  key: string;
  status: "QUIET" | "WATCH" | "EARLY_WARNING" | "BREAK";
  score: number;
  changePointIndex: number | null;
  direction: -1 | 0 | 1;
  leadMagnitude: number;
  persistence: number;
};

function mean(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function std(values: number[]) {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((s, x) => s + (x - m) ** 2, 0) / (values.length - 1));
}

/**
 * Sequential turning-point detector. It deliberately works on changes rather
 * than price levels, because a rising level can hide a change in momentum.
 * This is an early-warning detector, not a causal test.
 */
export function detectTurningPoint(
  signal: TurningPointSignal,
  baselineWindow = 12,
  confirmationWindow = 3,
): TurningPointResult {
  const ordered = [...signal.points].sort((a, b) => +new Date(a.date) - +new Date(b.date));
  if (ordered.length < baselineWindow + confirmationWindow + 2) {
    return { key: signal.key, status: "QUIET", score: 0, changePointIndex: null, direction: 0, leadMagnitude: 0, persistence: 0 };
  }

  const changes = ordered.slice(1).map((p, i) => p.value - ordered[i]!.value);
  const baseline = changes.slice(0, -confirmationWindow);
  const recent = changes.slice(-confirmationWindow);
  const m = mean(baseline.slice(-baselineWindow));
  const s = Math.max(std(baseline.slice(-baselineWindow)), 1e-9);
  const recentMean = mean(recent);
  const z = (recentMean - m) / s;
  const direction: -1 | 0 | 1 = z > 0.5 ? 1 : z < -0.5 ? -1 : 0;

  let cumulative = 0;
  let maxAbs = 0;
  let changePointIndex: number | null = null;
  const threshold = Math.max(2.5 * s, Math.abs(m) * 1.5, 1e-9);

  for (let i = Math.max(0, changes.length - baselineWindow * 2); i < changes.length; i++) {
    cumulative += changes[i]! - m;
    if (Math.abs(cumulative) > maxAbs) {
      maxAbs = Math.abs(cumulative);
      changePointIndex = i + 1;
    }
    if (Math.sign(cumulative) !== Math.sign(z) && Math.abs(cumulative) < threshold) cumulative = 0;
  }

  const persistence = recent.filter(x => Math.sign(x - m) === direction).length / recent.length;
  const leadMagnitude = Math.min(1, Math.abs(z) / 4);
  const persistenceScore = Math.min(1, persistence);
  const score = Math.min(1, 0.55 * leadMagnitude + 0.45 * persistenceScore);

  const status =
    score >= 0.82 && Math.abs(z) >= 2.5 && persistence >= 0.66 ? "BREAK"
      : score >= 0.62 && Math.abs(z) >= 1.75 && persistence >= 0.66 ? "EARLY_WARNING"
        : score >= 0.42 ? "WATCH"
          : "QUIET";

  return { key: signal.key, status, score, changePointIndex, direction, leadMagnitude, persistence };
}

export function fuseTurningPointSignals(
  signals: TurningPointSignal[],
  baselineWindow = 12,
  confirmationWindow = 3,
) {
  const results = signals.map(signal => detectTurningPoint(signal, baselineWindow, confirmationWindow));
  const weights = signals.map(signal => signal.weight ?? 1);
  const totalWeight = Math.max(1e-9, weights.reduce((a, b) => a + b, 0));
  const score = results.reduce((sum, result, i) => sum + result.score * weights[i]!, 0) / totalWeight;
  const positive = results.reduce((sum, result, i) => sum + (result.direction > 0 ? weights[i] : 0), 0);
  const negative = results.reduce((sum, result, i) => sum + (result.direction < 0 ? weights[i] : 0), 0);
  const agreement = Math.max(positive, negative) / totalWeight;
  const direction: -1 | 0 | 1 = positive > negative ? 1 : negative > positive ? -1 : 0;
  const status =
    score >= 0.78 && agreement >= 0.67 ? "BREAK"
      : score >= 0.58 && agreement >= 0.60 ? "EARLY_WARNING"
        : score >= 0.38 ? "WATCH"
          : "QUIET";

  return { status, score, agreement, direction, results };
}
