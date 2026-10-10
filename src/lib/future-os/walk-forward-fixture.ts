import type { Realization, WalkForwardCase } from "./walk-forward-runner";

export type WalkForwardFixture = {
  cases: readonly WalkForwardCase[];
  loadRealization: (item: WalkForwardCase) => Promise<Realization>;
};

export function buildDeterministicWalkForwardFixture(
  regions = 10,
  origins = 20,
): WalkForwardFixture {
  const cases: WalkForwardCase[] = [];
  const realizations = new Map<string, Realization>();

  for (let r = 0; r < regions; r += 1) {
    for (let o = 0; o < origins; o += 1) {
      const year = 2010 + o;
      const region = `CZ-${String(r + 1).padStart(2, "0")}`;
      const origin = `${year}-01-01`;
      const horizonEnd = `${year + 1}-01-01`;
      const key = `${region}|${origin}`;
      const realization: Realization = {
        value: (r + o) % 2 === 0 ? 1 : -1,
        direction: (r + o) % 2 === 0 ? 1 : -1,
      };

      cases.push({
        experimentId: "fixture-v0.1",
        region,
        origin,
        asOf: origin,
        horizonEnd,
        scenarioId: (r + o) % 2 === 0 ? "UP" : "DOWN",
        bottleneckEdgeId:
          (r + o) % 3 === 0 ? "BUYER_DEMAND_TO_TRANSACTIONS" : null,
        bottleneckStatus:
          (r + o) % 3 === 0 ? "IDENTIFIED" : "NO_BOTTLENECK",
        scenarioScore: 0.5 + ((r + o) % 5) * 0.05,
      });

      realizations.set(key, realization);
    }
  }

  return {
    cases,
    loadRealization: async (item) => {
      const realization = realizations.get(`${item.region}|${item.origin}`);
      if (!realization) {
        throw new Error(`Missing fixture realization: ${item.region}|${item.origin}`);
      }
      return realization;
    },
  };
}
