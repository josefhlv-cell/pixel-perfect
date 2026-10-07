import {describe,expect,it} from "vitest";
import {routeLearnedModelTrust} from "./learned-model-trust";

describe("learned model trust",()=>{
  it("routes matured high-skill feedback into model trust",()=>{
    const r=routeLearnedModelTrust([
      {modelId:"a",casesUsed:40,recentScore:.9,recentCalibration:.9,regime:"EXPANSION",submarket:"HRADEC",trust:.9,status:"STABLE"},
      {modelId:"b",casesUsed:40,recentScore:.4,recentCalibration:.5,regime:"EXPANSION",submarket:"HRADEC",trust:.45,status:"LEARNING"},
    ]);
    expect(r[0]?.model).toBe("a");
    expect(r[0]?.status).toBe("CHAMPION");
  });
});
