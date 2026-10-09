import {describe,expect,it} from "vitest"; import {counterfactualLab} from "./deal-counterfactual-lab";
describe("counterfactual lab",()=>{it("finds decision switch points",()=>{const r=counterfactualLab({price:80,fairValue:100,expectedReturn:.12,downside:-.08,confidence:.8,liquidity:.8,modelRisk:.1});expect(r.currentAction).toBe("BUY_NOW");expect(r.switchPoints.length).toBeGreaterThan(0);});});
