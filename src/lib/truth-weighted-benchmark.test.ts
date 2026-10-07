import {describe,expect,it} from "vitest";
import {truthWeightedBenchmark} from "./truth-weighted-benchmark";

describe("truth weighted benchmark",()=>{
  it("does not treat proxy observations as transaction truth",()=>{
    const forecasts=Array.from({length:12},(_,i)=>({
      id:`f${i}`,model:"A",cutoff:"2025-01-01",targetPeriod:"2026",
      p10:-.1,p50:.05,p90:.15,probabilityPositive:.7,
    }));
    const outcomes=forecasts.map(f=>({
      forecastId:f.id,realizedGrowth:.04,truthLevel:"ASKING" as const,availableAt:"2026-01-01",
    }));
    const [score]=truthWeightedBenchmark(forecasts,outcomes);
    expect(score?.validationClass).toBe("PROXY_ONLY");
    expect(score?.transactionN).toBe(0);
  });

  it("becomes transaction grounded only with enough realized outcomes",()=>{
    const forecasts=Array.from({length:12},(_,i)=>({
      id:`t${i}`,model:"A",cutoff:"2025-01-01",targetPeriod:"2026",
      p10:-.1,p50:.05,p90:.15,probabilityPositive:.7,
    }));
    const outcomes=forecasts.map(f=>({
      forecastId:f.id,realizedGrowth:.04,truthLevel:"TRANSACTION" as const,availableAt:"2026-01-01",
    }));
    const [score]=truthWeightedBenchmark(forecasts,outcomes);
    expect(score?.validationClass).toBe("TRANSACTION_GROUNDED");
    expect(score?.coverage90).toBe(1);
  });
});
