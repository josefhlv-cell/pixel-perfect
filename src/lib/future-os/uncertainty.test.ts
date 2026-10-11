import { describe, expect, it } from "vitest";
import { decomposeUncertainty } from "./uncertainty";

describe("Uncertainty decomposition", () => {
  it("identifies model disagreement as the dominant uncertainty", () => {
    const result = decomposeUncertainty({
      dataUncertainty: 0.1,
      modelDisagreement: 0.8,
      parameterUncertainty: 0.1,
      regimeUncertainty: 0.1,
    });
    expect(result.dominant).toBe("MODEL");
    expect(result.shares.model).toBeGreaterThan(0.7);
  });

  it("does not pretend to know the source when uncertainty is mixed", () => {
    const result = decomposeUncertainty({
      dataUncertainty: 0.5,
      modelDisagreement: 0.45,
      parameterUncertainty: 0.5,
      regimeUncertainty: 0.45,
    });
    expect(result.dominant).toBe("MIXED");
  });
});
