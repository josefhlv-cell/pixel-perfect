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
  // Mechanism tests, backtests and retraining can only be as informative as the
  // data they run on, so their value is discounted by data quality.
  const q = Math.max(0, Math.min(1, Number.isFinite(state.dataQuality) ? state.dataQuality : 0));
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
      expectedValue: state.modelDisagreement * state.uncertainty * q,
    },
    {
      priority: 0,
      action: "RUN_BACKTEST",
      reason: "Nejistota vyžaduje ověření proti historickým out-of-sample výsledkům.",
      expectedValue: state.uncertainty * 0.8 * q,
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
      expectedValue: Math.max(state.modelDisagreement, state.regimeRisk) * 0.9 * q,
    },
  ];
  return actions
    .map((action, index) => ({ ...action, priority: index + 1 }))
    .sort((a, b) => b.expectedValue - a.expectedValue)
    .map((action, index) => ({ ...action, priority: index + 1 }));
}
