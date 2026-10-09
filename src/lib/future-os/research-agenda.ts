import { nextBestObservation, type Hypothesis, type ObservationCandidate } from "./hypothesis-engine";

export type ResearchQuestion = {
  priority: number;
  question: string;
  observationKey: string;
  whyItMatters: string;
};

export function buildResearchAgenda(
  hypotheses: Hypothesis[],
  observations: ObservationCandidate[],
): ResearchQuestion[] {
  return nextBestObservation(hypotheses, observations).slice(0, 10).map((candidate, index) => ({
    priority: index + 1,
    question: "Zjistit aktuální stav signálu: " + candidate.key,
    observationKey: candidate.key,
    whyItMatters:
      "Toto pozorování má vysokou očekávanou schopnost rozlišit konkurenční budoucnosti při zohlednění spolehlivosti, ceny a latence.",
  }));
}
