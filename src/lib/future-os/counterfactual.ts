export type Shock = {
  key: string;
  delta: number;
  unit?: string;
  description?: string;
};

export type CausalEdge = {
  sourceKey: string;
  targetKey: string;
  expectedSign: -1 | 0 | 1;
  lagDays: number;
  strength: number;
  confidence: number;
};

export type CounterfactualNode = {
  key: string;
  baseline: number;
  shocked: number;
  delta: number;
  confidence: number;
};

export type CounterfactualResult = {
  baseline: Record<string, number>;
  shocked: Record<string, number>;
  nodes: CounterfactualNode[];
  propagatedEdges: Array<CausalEdge & { contribution: number }>;
  confidence: number;
  assumptions: string[];
};

export function runCounterfactual(
  state: Record<string, number>,
  shocks: Shock[],
  edges: CausalEdge[],
): CounterfactualResult {
  const baseline = { ...state };
  const shocked = { ...state };
  const assumptions = [
    "Výpočet používá pouze explicitně zadané kauzální hrany.",
    "Síla hrany je lokální citlivost, nikoli důkaz kauzality.",
    "Neznámé mechanismy nejsou automaticky doplňovány.",
    "Výsledek je scénář, nikoli tvrzení o jisté budoucnosti.",
  ];

  for (const shock of shocks) {
    if (Number.isFinite(shock.delta)) shocked[shock.key] = (shocked[shock.key] ?? 0) + shock.delta;
  }

  const propagatedEdges: Array<CausalEdge & { contribution: number }> = [];
  const ordered = [...edges].sort((a, b) => a.lagDays - b.lagDays);
  for (const edge of ordered) {
    const sourceDelta = (shocked[edge.sourceKey] ?? 0) - (baseline[edge.sourceKey] ?? 0);
    if (!sourceDelta) continue;
    const contribution = sourceDelta * edge.expectedSign * edge.strength * edge.confidence;
    shocked[edge.targetKey] = (shocked[edge.targetKey] ?? 0) + contribution;
    propagatedEdges.push({ ...edge, contribution });
  }

  const nodes = Object.keys(shocked).map((key) => ({
    key,
    baseline: baseline[key] ?? 0,
    shocked: shocked[key] ?? 0,
    delta: (shocked[key] ?? 0) - (baseline[key] ?? 0),
    confidence: Math.max(
      0,
      Math.min(
        1,
        edges.filter((edge) => edge.targetKey === key).reduce((sum, edge) => sum + edge.confidence, 0) /
          Math.max(1, edges.filter((edge) => edge.targetKey === key).length),
      ),
    ),
  }));

  const confidence = propagatedEdges.length
    ? propagatedEdges.reduce((sum, edge) => sum + edge.confidence, 0) / propagatedEdges.length
    : 0;

  return { baseline, shocked, nodes, propagatedEdges, confidence, assumptions };
}
