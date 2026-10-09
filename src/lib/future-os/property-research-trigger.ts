import { prioritizeResearch, type ResearchAction } from "./research-loop";
import { type UncertaintyDecomposition } from "./uncertainty";

export type PropertyResearchTrigger = {
  uncertainty: UncertaintyDecomposition;
  marketActions: ResearchAction[];
  decisionNeedsResearch: boolean;
  reason: string;
};

export function buildPropertyResearchTrigger(
  uncertainty: UncertaintyDecomposition,
): PropertyResearchTrigger {
  const actions = prioritizeResearch({
    uncertainty: uncertainty.total,
    dataQuality: uncertainty.shares.data,
    modelDisagreement: uncertainty.shares.model,
    regimeRisk: uncertainty.shares.regime,
    unresolvedHypotheses: 1,
  });
  const decisionNeedsResearch = uncertainty.total >= 0.45 || uncertainty.dominant === "REGIME";
  const reason = decisionNeedsResearch
    ? "Investiční rozhodnutí je citlivé na nejistotu; ověřit dominantní zdroj nejistoty před finálním rozhodnutím."
    : "Nejistota je pod kontrolou; pokračovat ve standardním monitoringu.";
  return { uncertainty, marketActions: actions, decisionNeedsResearch, reason };
}
