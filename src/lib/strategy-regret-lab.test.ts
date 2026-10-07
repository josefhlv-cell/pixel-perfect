import {describe,expect,it} from "vitest";
import {scoreStrategyRegret} from "./strategy-regret-lab";

describe("strategy regret lab",()=>{
  it("separates realized utility from regret",()=>{
    const r=scoreStrategyRegret([
      {cutoff:"2025-01",strategyId:"A",action:"BUY",realizedReturn:.12,downside:.05,decisionConfidence:.9},
      {cutoff:"2025-01",strategyId:"B",action:"WAIT",realizedReturn:.04,downside:.01,decisionConfidence:.8},
    ]);
    expect(r[0]?.strategyId).toBe("A");
    expect(r[0]?.regretVsBest).toBe(0);
  });
});
