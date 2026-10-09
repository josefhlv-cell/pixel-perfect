export type DecisionAction = "BUY" | "NEGOTIATE" | "WAIT" | "PASS";

export type DecisionScenario = {
  action: DecisionAction;
  expectedUtility: number;
  realizedUtility: number;
};

export function decisionRegret(chosen: DecisionScenario, alternatives: DecisionScenario[]): number {
  const bestRealized = Math.max(chosen.realizedUtility, ...alternatives.map((scenario) => scenario.realizedUtility));
  return Math.max(0, bestRealized - chosen.realizedUtility);
}

export function strategyRegret(
  decisions: Array<{ chosen: DecisionScenario; alternatives: DecisionScenario[] }>,
) {
  if (!decisions.length) return { meanRegret: 0, maxRegret: 0, regretRate: 0 };
  const regrets = decisions.map(({ chosen, alternatives }) => decisionRegret(chosen, alternatives));
  return {
    meanRegret: regrets.reduce((s, x) => s + x, 0) / regrets.length,
    maxRegret: Math.max(...regrets),
    regretRate: regrets.filter((x) => x > 0).length / regrets.length,
  };
}
