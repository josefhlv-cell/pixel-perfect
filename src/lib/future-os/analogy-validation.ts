import { evaluateIncrementalPredictiveValue } from "./incremental-value";
import { findHistoricalAnalogs, type MarketState } from "./historical-analogs";

export type AnalogyValidation = {
  analogs: ReturnType<typeof findHistoricalAnalogs>;
  predictiveValue: ReturnType<typeof evaluateIncrementalPredictiveValue>;
  accepted: boolean;
};

export function validateHistoricalAnalogy(
  current: Record<string, number>,
  history: MarketState[],
  baselineLosses: number[],
  analogyModelLosses: number[],
): AnalogyValidation {
  const analogs=findHistoricalAnalogs(current,history);
  const predictiveValue=evaluateIncrementalPredictiveValue(baselineLosses,analogyModelLosses);
  return {
    analogs,
    predictiveValue,
    accepted: predictiveValue.status==="USEFUL",
  };
}
