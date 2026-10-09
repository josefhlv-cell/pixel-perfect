import { describe, expect, it } from "vitest";
import { championFromLab, runModelLab, type LabObservation } from "./prediction-model-lab";

const rows:LabObservation[]=Array.from({length:36},(_,i)=>({
  date:`2024-${String((i%12)+1).padStart(2,"0")}-01`,
  priceM2:100000+i*850+(i%5)*120,
  listings:1000+Math.round(Math.sin(i/3)*80)-i*3,
}));

describe("prediction model lab",()=>{
  it("runs chronological forecasts without requiring a random split",()=>{
    const out=runModelLab(rows,{horizonMonths:1,minHistory:12});
    expect(out.forecasts.length).toBeGreaterThan(0);
    expect(out.metrics.every(m=>m.samples>0)).toBe(true);
    expect(out.metrics.every(m=>Number.isFinite(m.compositeScore))).toBe(true);
  });

  it("selects a champion by the composite out-of-sample score",()=>{
    const out=runModelLab(rows,{horizonMonths:1,minHistory:12});
    const champion=championFromLab(out.metrics);
    expect(champion).not.toBeNull();
    expect(champion?.compositeScore).toBe(Math.min(...out.metrics.map(m=>m.compositeScore)));
  });

  it("keeps probabilistic intervals attached to each forecast origin",()=>{
    const out=runModelLab(rows,{horizonMonths:1,minHistory:12});
    expect(out.forecasts.every(f=>f.lower90Bps<f.upper90Bps)).toBe(true);
    expect(out.forecasts.every(f=>f.p10Bps<=f.p50Bps&&f.p50Bps<=f.p90Bps)).toBe(true);
  });
});
