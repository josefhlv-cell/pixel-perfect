import type { ImpactPath } from "./impact-propagation";

export type CausalChainStep = {
  key: string;
  sign: 1 | -1;
  lagDays: number;
  confidence: number;
};

export function buildCausalChain(
  sourceKey: string,
  targetKey: string,
  edges: ImpactPath[],
): CausalChainStep[] | null {
  const adjacency = new Map<string, ImpactPath[]>();
  for (const edge of edges) {
    const list = adjacency.get(edge.from) ?? [];
    list.push(edge);
    adjacency.set(edge.from, list);
  }

  const queue: Array<{ key: string; path: CausalChainStep[] }> = [{ key: sourceKey, path: [] }];
  const visited = new Set<string>();

  while (queue.length) {
    const current = queue.shift()!;
    if (current.key === targetKey) return current.path;
    if (visited.has(current.key)) continue;
    visited.add(current.key);

    for (const edge of adjacency.get(current.key) ?? []) {
      queue.push({
        key: edge.to,
        path: [...current.path, {
          key: edge.to,
          sign: edge.sign,
          lagDays: edge.lagDays,
          confidence: edge.confidence,
        }],
      });
    }
  }

  return null;
}

export function chainLagDays(chain: CausalChainStep[]): number {
  return chain.reduce((sum, step) => sum + Math.max(0, step.lagDays), 0);
}

export function chainConfidence(chain: CausalChainStep[]): number {
  if (!chain.length) return 0;
  return chain.reduce((product, step) => product * step.confidence, 1);
}
