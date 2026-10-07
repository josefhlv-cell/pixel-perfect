import { describe, expect, it } from "vitest";
import { updateProbability } from "./prediction-bayes";
import { defaultMarketFalsifiers, falsifyForecast } from "./prediction-falsifier";
import { decisionFromForecast } from "./prediction-decision";

describe("forecast science layers",()=>{
  it("updates a prior from directional evidence",()=>{
    const out=updateProbability(0.5,[{
      name:"falling mortgage rates",
      direction:"BULLISH",
      likelihoodRatio:2,
      reliability:0.9,
      sourceQuality:0.9
    }]);
    expect(out.posteriorProbability).toBeGreaterThan(0.5);
    expect(out.entropy).toBeLessThanOrEqual(1);
  });

  it("can kill a forecast before the market does",()=>{
    const out=falsifyForecast(
      {realizedGrowthBps:-2000,mortgageRateChangeBps:250,inventoryChangeBps:500,domChangeBps:500},
      defaultMarketFalsifiers(1000)
    );
    expect(out.invalidated).toBe(true);
    expect(out.triggered.length).toBeGreaterThan(0);
  });

  it("prefers caution when confidence is weak",()=>{
    const out=decisionFromForecast({
      probabilityGain:0.8,
      probabilityLoss:0.1,
      expectedReturnBps:1000,
      downsideP10Bps:-2500,
      liquidity:0.8,
      confidence:0.2
    });
    expect(out.action).toBe("WATCH");
  });
});
