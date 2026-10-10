export type PropertyTwinInput = {
  purchasePrice: number;
  fairValue: number;
  fairValueP10?: number;
  fairValueP90?: number;
  valuationConfidence?: number;
  monthlyRent: number;
  monthlyCosts: number;
  financingRate: number;
  loanAmount: number;
  horizonMonths: number;
  marketGrowthP50: number;
  marketGrowthP10: number;
  marketGrowthP90: number;
  liquidityScore: number;
};

export type PropertyScenario = {
  name: "UPSIDE" | "BASE" | "DOWNSIDE";
  annualPriceGrowth: number;
  exitValue: number;
  annualRent: number;
  grossYield: number;
  equityGain: number;
  netCashflow: number;
  totalReturn: number;
};

export type PropertyDecision = {
  action: "BUY" | "NEGOTIATE" | "WAIT" | "PASS";
  maxSafePrice: number;
  marginOfSafety: number;
  downside: number;
  scenarios: PropertyScenario[];
  conditionsThatChangeDecision: string[];
};

function scenario(
  name: PropertyScenario["name"],
  input: PropertyTwinInput,
  growth: number,
): PropertyScenario {
  const years = input.horizonMonths / 12;
  const exitValue = input.purchasePrice * (1 + growth) ** years;
  const annualRent = input.monthlyRent * 12;
  const grossYield = annualRent / input.purchasePrice;
  const netCashflow = (input.monthlyRent - input.monthlyCosts) * input.horizonMonths;
  const equityGain = exitValue - input.purchasePrice;
  const totalReturn = equityGain + netCashflow;
  return { name, annualPriceGrowth: growth, exitValue, annualRent, grossYield, equityGain, netCashflow, totalReturn };
}

export function buildPropertyFutureTwin(input: PropertyTwinInput): PropertyDecision {
  const scenarios = [
    scenario("UPSIDE", input, input.marketGrowthP90),
    scenario("BASE", input, input.marketGrowthP50),
    scenario("DOWNSIDE", input, input.marketGrowthP10),
  ];
  const valuationConfidence = input.valuationConfidence ?? 0.5;
  const fairValueP10 = input.fairValueP10 ?? input.fairValue * 0.9;
  const fairValueP90 = input.fairValueP90 ?? input.fairValue * 1.1;
  const marginOfSafety = input.fairValue > 0 ? (input.fairValue - input.purchasePrice) / input.fairValue : 0;
  const valuationRangeWidth = input.fairValue > 0 ? (fairValueP90 - fairValueP10) / input.fairValue : 1;
  const downside = scenarios[2]!.totalReturn;
  const maxSafePrice = Math.max(0, input.fairValue * (1 - Math.max(0.05, 0.12 - input.liquidityScore * 0.05)));

  let action: PropertyDecision["action"];
  if (marginOfSafety >= 0.12 && downside >= 0 && input.liquidityScore >= 0.55 && valuationConfidence >= 0.7 && valuationRangeWidth <= 0.3) action = "BUY";
  else if (marginOfSafety >= 0.03 && downside >= 0) action = "NEGOTIATE";
  else if (marginOfSafety < 0 && input.marketGrowthP50 >= 0) action = "WAIT";
  else action = "PASS";

  const conditionsThatChangeDecision: string[] = [];
  if (input.financingRate >= 6) conditionsThatChangeDecision.push("Pokud financování překročí 6 %, přepočítat cashflow a max safe price.");
  if (input.liquidityScore < 0.5) conditionsThatChangeDecision.push("Pokud likvidita klesne pod 0,5, zvýšit margin of safety.");
  if (input.marketGrowthP10 < -0.05) conditionsThatChangeDecision.push("Pokud downside scénář překročí -5 % ročního růstu, vyžadovat výraznější diskont.");
  if (input.fairValue <= 0) conditionsThatChangeDecision.push("Bez spolehlivého fair value nelze potvrdit BUY.");
  if (valuationConfidence < 0.7) conditionsThatChangeDecision.push("Nízká jistota valuace omezuje rozhodnutí BUY.");
  if (valuationRangeWidth > 0.3) conditionsThatChangeDecision.push("Široké rozpětí fair value vyžaduje vyšší margin of safety.");

  return { action, maxSafePrice, marginOfSafety, downside, scenarios, conditionsThatChangeDecision };
}
