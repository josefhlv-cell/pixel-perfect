import {describe,it,expect} from "vitest";
import {scoreTournament} from "./model-tournament-v2";
import {replayForecastHistory} from "./replay-orchestrator";
import {buildMicroMarkets} from "./micro-market-engine";
import {calibrateInterval} from "./regime-calibrated-interval";
import {createForecastIdentity} from "./forecast-vintage-engine";
import {fuseSignals} from "./source-fusion-router";
import {runCounterfactual} from "./future-counterfactual-engine";
import {falsify} from "./forecast-falsifier";
describe("Future Intelligence V2",()=>{
 it("ranks models",()=>expect(scoreTournament([{id:"NAIVE",prediction:1,lower:.5,upper:1.5,confidence:.8},{id:"MOMENTUM",prediction:2,lower:1,upper:3,confidence:.8}],1.1,.9)[0]!.id).toBe("NAIVE"));
 it("replays point-in-time cases",()=>expect(replayForecastHistory([{id:"x",eventTime:"2026-01-01",availableAt:"2026-01-02",value:1}],[{cutoff:"2026-01-05",horizonMonths:6,predicted:2,lower:1,upper:3,modelVersion:"A"}],{"2026-01-05|6":2}).length).toBe(1));
 it("builds local micro markets",()=>expect(buildMicroMarkets([{lat:50,lon:15,priceM2:100,quality:1},{lat:50.001,lon:15,priceM2:110,quality:1}],1)).toHaveLength(1));
 it("blocks weak interval calibration",()=>expect(calibrateInterval(0,1,.9).status).toBe("INSUFFICIENT_DATA"));
 it("creates reproducible identity",()=>expect(createForecastIdentity("m","d","f",{version:"v1",cutoff:"2026-01-01",sourceHash:"h",createdAt:"2026-01-01"}).reproducibilityKey).toContain("h"));
 it("detects source conflict",()=>expect(fuseSignals([{source:"a",metric:"p",value:1,reliability:1,latencyDays:0,independenceGroup:"a"},{source:"b",metric:"p",value:3,reliability:1,latencyDays:0,independenceGroup:"b"}])[0]!.conflict).toBeGreaterThan(0));
 it("runs counterfactuals",()=>expect(runCounterfactual(1,[{intervention:"rate cut",delta:.1,confidence:.8,mechanism:["credit"]}]).bestUpside).not.toBeNull());
 it("falsifies forecasts",()=>expect(falsify([{metric:"x",operator:"GT",threshold:1,message:"break"}],{x:2}).invalidated).toBe(true));
});