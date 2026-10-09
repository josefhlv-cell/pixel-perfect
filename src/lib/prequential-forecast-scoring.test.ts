import {describe,expect,it} from "vitest";
import {scorePrequential} from "./prequential-forecast-scoring";

describe("prequential forecast scoring",()=>{
  it("rewards correct confident forecasts",()=>{
    const r=scorePrequential([
      {issuedAt:"2025-01",probabilities:{A:.9,B:.1},outcome:"A"},
      {issuedAt:"2025-02",probabilities:{A:.8,B:.2},outcome:"A"},
    ]);
    expect(r.directionalAccuracy).toBe(1);
    expect(r.logLoss).toBeLessThan(.3);
  });
  it("penalizes confident wrong forecasts",()=>{
    const r=scorePrequential([
      {issuedAt:"2025-01",probabilities:{A:.99,B:.01},outcome:"B"},
    ]);
    expect(r.logLoss).toBeGreaterThan(4);
  });
});
