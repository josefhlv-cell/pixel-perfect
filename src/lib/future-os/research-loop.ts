export type ResearchState = {
  uncertainty: number;
  dataQuality: number;
  modelDisagreement: number;
  regimeRisk: number;
  unresolvedHypotheses: number;
};

export type ResearchAction = {
  priority: number;
  action: "COLLECT_DATA" | "TEST_MECHANISM" | "RUN_BACKTEST" | "FALSIFY" | "RETRAIN";
  reason: string;
  expectedValue: number;
};

export function prioritizeResearch(state: ResearchState): ResearchAction[] {
  const actions: ResearchAction[] = [
    {
      priority: 0,
      action: "COLLECT_DATA",
      reason: "Data quality je nízká a nejistotu lze snížit novým pozorováním.",
      expectedValue: state.uncertainty * (1 - state.dataQuality),
    },
    {
      priority: 0,
      action: "TEST_MECHANISM",
      reason: "Konkurenční mechanismy nejsou dostatečně rozlišené.",
      expectedValue: state.modelDisagreement * state.uncertainty,
    },
    {
      priority: 0,
      action: "RUN_BACKTEST",
      reason: "Nejistota vyžaduje ověření proti historickým out-of-sample výsledkům.",
      expectedValue: state.uncertainty * 0.8,
    },
    {
      priority: 0,
      action: "FALSIFY",
      reason: "Vysoké riziko režimové změny vyžaduje aktivní hledání proti-důkazů.",
      expectedValue: state.regimeRisk * state.uncertainty,
    },
    {
      priority: 0,
      action: "RETRAIN",
      reason: "Rozpor modelů nebo režimový zlom může znamenat ztrátu relevance Champion modelu.",
      expectedValue: Math.max(state.modelDisagreement, state.regimeRisk) * 0.9,
    },
  ];
  return actions
    .map((action, index) => ({ ...action, priority: index + 1 }))
    .sort((a, b) => b.expectedValue - a.expectedValue)
    .map((action, index) => ({ ...action, priority: index + 1 }));
}
