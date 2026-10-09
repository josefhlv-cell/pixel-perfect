export type CounterfactualDelta = {
  key: string;
  observed: number;
  counterfactual: number;
  delta: number;
  contribution: number;
};

export function explainCounterfactual(
  observed: Record<string, number>,
  counterfactual: Record<string, number>,
): CounterfactualDelta[] {
  const keys = new Set([...Object.keys(observed), ...Object.keys(counterfactual)]);
  const raw = [...keys].map((key) => {
    const a = observed[key] ?? 0;
    const b = counterfactual[key] ?? 0;
    return { key, observed: a, counterfactual: b, delta: a - b, contribution: Math.abs(a - b) };
  });
  const total = raw.reduce((s, x) => s + x.contribution, 0);
  return raw
    .map((x) => ({ ...x, contribution: total ? x.contribution / total : 0 }))
    .sort((a,b) => b.contribution - a.contribution);
}
