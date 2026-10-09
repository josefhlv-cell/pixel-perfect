import {describe,expect,it} from "vitest";
import {buildTruthLayer} from "./truth-layer";

describe("truth layer",()=>{
  it("prefers transactions and blocks validation without enough history",()=>{
    const r=buildTruthLayer([
      ...Array.from({length:24},(_,i)=>({
        id:`t${i}`,geography:"Hradec",period:`2024-${i}`,
        metric:"PRICE_M2" as const,value:60000+i*100,
        truthLevel:"TRANSACTION" as const,eventTime:"2024-01-01",
        availableAt:"2024-02-01",source:"CZSO/CUZK",reliability:.95,
      })),
      {id:"ask",geography:"Hradec",period:"2026",metric:"PRICE_M2",value:72000,
       truthLevel:"ASKING",eventTime:"2026-09-01",availableAt:"2026-09-01",
       source:"listing",reliability:.65},
    ]);
    expect(r.dominantTruth).toBe("TRANSACTION");
    expect(r.validationReady).toBe(true);
    expect(r.realizedPrice).toBeGreaterThan(0);
    expect(r.askingRealizedGap).toBeGreaterThan(0);
  });
});
