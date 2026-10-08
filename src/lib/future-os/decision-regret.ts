export type DecisionAction = "BUY" | "NEGOTIATE" | "WAIT" | "PASS";

export type DecisionScenario = {
  action: DecisionAction;
  expectedUtility: number;
  realizedUtility: number;
};

export function decisionRegret(scenario: DecisionScenario): number {
  const bestRealized = scenario.realizedUtility;
  return Math.max(0, bestRealized - scenario.expectedUtility);
}

export function strategyRegret(
  decisions: DecisionScenario[],
) {
  if (!decisions.length) return { meanRegret: 0, maxRegret: 0, regretRate: 0 };
  const regrets = decisions.map(decisionRegret);
  return {
    meanRegret: regrets.reduce((s, x) => s + x, 0) / regrets.length,
    maxRegret: Math.max(...regrets),
    regretRate: regrets.filter((x) => x > 0).length / regrets.length,
  };
}
