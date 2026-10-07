import {describe,expect,it} from "vitest";
import {buildTransactionBenchmark} from "./transaction-benchmark";
import type {TransactionObservation} from "./transaction-universe";

const tx=(id:string,period:string,priceM2:number):TransactionObservation=>({
  id,geography:"Hradec",propertyType:"APARTMENT",eventTime:period+"-15",
  availableAt:period+"-20",price:priceM2*50,areaM2:50,priceM2,
  transactionKind:"SALE",source:"CUZK",quality:.95,
});

describe("transaction benchmark",()=>{
  it("builds realized 12 month growth outcomes",()=>{
    const r=buildTransactionBenchmark([
      tx("a","2024-01",60000),
      tx("b","2024-01",62000),
      tx("c","2025-01",66000),
      tx("d","2025-01",68000),
    ],"Hradec",12);
    expect(r).toHaveLength(1);
    expect(r[0]?.realizedGrowth).toBeCloseTo(68000/62000-1,6);
  });

  it("never substitutes a different geography",()=>{
    const r=buildTransactionBenchmark([tx("a","2024-01",60000),{...tx("b","2025-01",70000),geography:"Brno"}],"Hradec",12);
    expect(r).toHaveLength(0);
  });
});
