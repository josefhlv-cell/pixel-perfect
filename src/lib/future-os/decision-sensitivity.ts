import { buildPropertyFutureTwin, type PropertyTwinInput } from "./property-future-twin";

export type DecisionChange = {
  field: keyof PropertyTwinInput;
  before: number;
  after: number;
  delta: number;
  decisionBefore: ReturnType<typeof buildPropertyFutureTwin>["action"];
  decisionAfter: ReturnType<typeof buildPropertyFutureTwin>["action"];
  changedDecision: boolean;
};

export function explainDecisionSensitivity(
  input: PropertyTwinInput,
  changes: Partial<Record<keyof PropertyTwinInput, number>>,
): DecisionChange[] {
  const before = buildPropertyFutureTwin(input);
  return (Object.keys(changes) as Array<keyof PropertyTwinInput>).flatMap((field) => {
    const afterValue = changes[field];
    if (typeof afterValue !== "number") return [];
    const next = { ...input, [field]: afterValue };
    const after = buildPropertyFutureTwin(next);
    return [{
      field,
      before: Number(input[field]),
      after: afterValue,
      delta: afterValue - Number(input[field]),
      decisionBefore: before.action,
      decisionAfter: after.action,
      changedDecision: before.action !== after.action,
    }];
  }).sort((a,b) => Number(b.changedDecision) - Number(a.changedDecision) || Math.abs(b.delta) - Math.abs(a.delta));
}
