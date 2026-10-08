export type ImpactNode = {
  key: string;
  value: number;
  confidence: number;
  depth: number;
};

export type ImpactPath = {
  from: string;
  to: string;
  sign: 1 | -1;
  lagDays: number;
  confidence: number;
};

export function propagateImpact(
  sourceKey: string,
  sourceValue: number,
  edges: ImpactPath[],
  maxDepth = 6,
): ImpactNode[] {
  const adjacency = new Map<string, ImpactPath[]>();
  for (const edge of edges) {
    const list = adjacency.get(edge.from) ?? [];
    list.push(edge);
    adjacency.set(edge.from, list);
  }

  const best = new Map<string, ImpactNode>();
  const queue: Array<{ key: string; value: number; confidence: number; depth: number }> = [
    { key: sourceKey, value: sourceValue, confidence: 1, depth: 0 },
  ];

  while (queue.length) {
    const current = queue.shift()!;
    if (current.depth >= maxDepth) continue;

    for (const edge of adjacency.get(current.key) ?? []) {
      const value = current.value * edge.sign;
      const confidence = current.confidence * Math.max(0, Math.min(1, edge.confidence));
      const next = { key: edge.to, value, confidence, depth: current.depth + 1 };
      const existing = best.get(edge.to);
      if (!existing || confidence > existing.confidence) {
        best.set(edge.to, next);
        queue.push(next);
      }
    }
  }

  return [...best.values()].sort((a,b) => b.confidence - a.confidence);
}
