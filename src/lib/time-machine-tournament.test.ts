import {describe,expect,it} from "vitest";
import {runTimeMachineTournament} from "./time-machine-tournament";

describe("time machine tournament",()=>{
  const forecasts=Array.from({length:24},(_,i)=>({
    id:`f${i}`,model:"TEMPORAL" as const,cutoff:`2024-01-${String((i%9)+1).padStart(2,"0")}`,
    horizonMonths:12,p10:-.05,p50:.05,p90:.15,probabilityPositive:.7,
    regime:"EXPANSION",evidenceQuality:.8,
  }));
  it("blocks champion without enough realized outcomes",()=>{
    const r=runTimeMachineTournament(forecasts,[]);
    expect(r.champion).toBeNull();
    expect(r.scores[0]?.calibrationStatus).toBe("INSUFFICIENT_OUTCOMES");
  });
  it("selects an empirical champion when outcomes exist",()=>{
    const outcomes=forecasts.map((f)=>({forecastId:f.id,realizedGrowth:.04,observedAt:"2025-01-01"}));
    const r=runTimeMachineTournament(forecasts,outcomes);
    expect(r.champion).toBe("TEMPORAL");
    expect(r.scores[0]?.calibrationStatus).toBe("EMPIRICAL");
    expect(r.scores[0]?.coverage90).toBe(1);
  });
});
