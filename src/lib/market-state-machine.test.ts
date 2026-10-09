import { describe,expect,it } from "vitest";
import { marketStateMachine } from "./market-state-machine";

const base={
  priceGrowth:.07,rentGrowth:.04,inventoryGrowth:-.08,domGrowth:.02,
  liquidity:.8,volatility:.08,transactionDensity:.8,mortgageRateChange:0,
  creditGrowth:.05,supplyGrowth:-.03,evidenceQuality:.85
};

describe("market state machine",()=>{
  it("detects expansion and routes models",()=>{
    const r=marketStateMachine(base);
    expect(r.state).toBe("EXPANSION");
    expect(r.routing[0]!.weight).toBeGreaterThan(0);
    expect(r.stateConfidence).toBeGreaterThan(.5);
  });

  it("recognizes liquidity stress",()=>{
    const r=marketStateMachine({...base,liquidity:.15,domGrowth:.35});
    expect(r.state).toBe("LIQUIDITY_STRESS");
    expect(r.watchTriggers.join(" ")).toContain("exit liquidity");
  });

  it("blocks overconfidence when data are sparse",()=>{
    const r=marketStateMachine({...base,evidenceQuality:.1,transactionDensity:.05});
    expect(r.state).toBe("DATA_STARVED");
    expect(r.stateConfidence).toBeLessThan(.6);
  });
});
