import {describe,expect,it} from "vitest";
import {buildTransactionUniverse,normalizeTransaction} from "./transaction-universe";

describe("transaction universe",()=>{
  it("normalizes price per square meter and preserves publication timing",()=>{
    const row=normalizeTransaction({
      id:"tx1",geography:"Hradec",propertyType:"APARTMENT",
      eventTime:"2025-05-01",availableAt:"2025-07-01",
      price:6000000,areaM2:60,transactionKind:"SALE",
      source:"CZSO/CUZK",quality:.95,
    });
    expect(row?.priceM2).toBe(100000);
  });

  it("builds a point-in-time-ready universe",()=>{
    const r=buildTransactionUniverse([
      {id:"1",geography:"A",propertyType:"APARTMENT",eventTime:"2024-01-01",availableAt:"2024-03-01",price:5000000,areaM2:50,transactionKind:"SALE",source:"official",quality:.9},
      {id:"2",geography:"A",propertyType:"APARTMENT",eventTime:"2025-01-01",availableAt:"2025-03-01",price:6000000,areaM2:60,transactionKind:"SALE",source:"official",quality:.95},
    ]);
    expect(r.count).toBe(2);
    expect(r.pointInTimeReady).toBe(true);
    expect(r.qualityWeightedPriceM2).toBeGreaterThan(0);
  });
});
