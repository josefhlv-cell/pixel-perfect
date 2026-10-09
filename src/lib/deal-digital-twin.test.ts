import { describe,expect,it } from "vitest";
import { dealDigitalTwin } from "./deal-digital-twin";

const base={
  purchasePrice:5000000,
  areaM2:65,
  monthlyRent:22000,
  equity:1500000,
  mortgageRate:.05,
  mortgageYears:25,
  holdingYears:10,
  vacancyRate:.05,
  operatingCostRate:.12,
  maintenancePerM2Annual:900,
  annualRentGrowth:.025,
  annualPriceGrowth:.03,
  saleCostRate:.03,
  acquisitionCostRate:.04,
  taxRate:0,
  capexReserve:.005,
};

describe("deal digital twin",()=>{
  it("produces ordered IRR quantiles and scenario outcomes",()=>{
    const r=dealDigitalTwin(base);
    expect(r.pathOutcomes.length).toBe(6);
    expect(r.p10Irr).toBeLessThanOrEqual(r.medianIrr);
    expect(r.medianIrr).toBeLessThanOrEqual(r.p90Irr);
    expect(r.worstIrr).toBeLessThanOrEqual(r.bestIrr);
  });

  it("finds stress breakpoints without recursive simulation",()=>{
    const r=dealDigitalTwin(base);
    expect(r.breakpoints.length).toBeGreaterThan(0);
    expect(r.breakpoints.every(x=>Number.isFinite(x.threshold))).toBe(true);
  });

  it("blocks invalid inputs",()=>{
    const r=dealDigitalTwin({...base,purchasePrice:0});
    expect(r.decision).toBe("PASS");
    expect(r.pathOutcomes.length).toBe(0);
  });
});
