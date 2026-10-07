import {describe,expect,it} from "vitest";
import {pointInTimeDataset,auditAvailability} from "./data-universe";
import {scientificVerdict} from "./scientific-protocol";
import {auditContract} from "./forecast-contracts";
describe("scientific integrity",()=>{
 it("excludes information that was not available at cutoff",()=>{
  const rows=[{id:"a",kind:"MACRO" as const,geography:"CZ",eventTime:"2025-01-01",availableAt:"2025-02-01",value:1,unit:"x",source:"x",truthLevel:"MACRO" as const,quality:1}];
  expect(pointInTimeDataset(rows,"2025-01-15").rows).toHaveLength(0);
  expect(auditAvailability(rows,"2025-01-15")).toHaveLength(1);
 });
 it("rejects scientific claims with leakage",()=>{
  expect(scientificVerdict({model:"x",baseline:"b",horizonMonths:12,oosScore:.8,baselineScore:.7,improvementPct:14,calibrationError:.05,intervalCoverage:.9,leakageIssues:1,driftScore:.1,sampleSize:1000}).status).toBe("REJECTED");
 });
 it("audits a forecast contract",()=>{
  const c={id:"1",createdAt:"2026-01-01",dataCutoff:"2026-01-01",geography:"Brno",horizonMonths:12,target:"price_growth_bps",p10:-100,p50:500,p90:1200,probabilityPositive:.7,confidence:.8,modelVersion:"x",baselineVersion:"b",falsifiers:[]};
  expect(auditContract(c,700,{}).status).toBe("VERIFIED");
 });
});
