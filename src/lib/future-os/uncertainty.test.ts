import { describe, expect, it } from "vitest";
import { decomposeUncertainty } from "./uncertainty";

describe("Uncertainty decomposition",()=>{
  it("identifies model disagreement as the dominant uncertainty",()=>{
    const result=decomposeUncertainty({dataUncertainty:.1,modelDisagreement:.8,parameterUncertainty:.1,regimeUncertainty:.1});
    expect(result.dominant).toBe("MODEL");
    expect(result.shares.model).toBeGreaterThan(.7);
  });

  it("does not pretend to know the source when uncertainty is mixed",()=>{
    const result=decomposeUncertainty({dataUncertainty:.5,modelDisagreement:.45,parameterUncertainty:.5,regimeUncertainty:.45});
    expect(result.dominant).toBe("MIXED");
  });
});
