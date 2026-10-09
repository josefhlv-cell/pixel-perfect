import { buildPropertyFutureTwin, type PropertyTwinInput } from "./property-future-twin";

export type PropertyShock = {
  key: "RATE" | "SUPPLY" | "MIGRATION" | "LIQUIDITY";
  delta: number;
};

export type ShockOutcome = {
  shocks: PropertyShock[];
  action: ReturnType<typeof buildPropertyFutureTwin>["action"];
  downside: number;
  maxSafePrice: number;
};

export function runPropertyShockMatrix(
  input: PropertyTwinInput,
  shockSets: PropertyShock[][],
): ShockOutcome[] {
  return shockSets.map((shocks) => {
    const adjusted = { ...input };
    for (const shock of shocks) {
      if (shock.key === "RATE") adjusted.financingRate += shock.delta;
      if (shock.key === "SUPPLY") adjusted.marketGrowthP50 -= shock.delta;
      if (shock.key === "MIGRATION") adjusted.marketGrowthP50 += shock.delta;
      if (shock.key === "LIQUIDITY") adjusted.liquidityScore = Math.max(0, Math.min(1, adjusted.liquidityScore + shock.delta));
    }
    const twin = buildPropertyFutureTwin(adjusted);
    return { shocks, action: twin.action, downside: twin.downside, maxSafePrice: twin.maxSafePrice };
  });
}

export function findDecisionBoundary(outcomes: ShockOutcome[]) {
  const safe = outcomes.filter((x) => x.action === "BUY" || x.action === "NEGOTIATE");
  const unsafe = outcomes.filter((x) => x.action === "WAIT" || x.action === "PASS");
  return {
    safeCount: safe.length,
    unsafeCount: unsafe.length,
    resilience: outcomes.length ? safe.length / outcomes.length : 0,
    firstFailure: unsafe[0] ?? null,
  };
}
