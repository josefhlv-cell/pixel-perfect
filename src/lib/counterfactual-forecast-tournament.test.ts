import {describe,expect,it} from "vitest";
import {runCounterfactualTournament} from "./counterfactual-forecast-tournament";

describe("counterfactual forecast tournament",()=>{
  it("measures hindsight regret without using the oracle for selection",()=>{
    const r=runCounterfactualTournament([{
      cutoff:"2025-01-01",context:"HRADEC|EXPANSION|12",
      candidates:[
        {id:"A",model:"A",score:.8,confidence:.8,evidenceCases:30},
        {id:"B",model:"B",score:.7,confidence:.7,evidenceCases:30},
      ],
      realizedValue:10,
      predictedValues:{A:9,B:7},
      selectedStrategyId:"A",
    }]);
    expect(r.scores[0]?.strategyId).toBe("A");
    expect(r.selectedVsOracleRegret).toBe(0);
  });
  it("shows regret when historical selection missed the best strategy",()=>{
    const r=runCounterfactualTournament([{
      cutoff:"2025-01-01",context:"HRADEC|CORRECTION|12",
      candidates:[
        {id:"A",model:"A",score:.8,confidence:.8,evidenceCases:30},
        {id:"B",model:"B",score:.7,confidence:.7,evidenceCases:30},
      ],
      realizedValue:10,
      predictedValues:{A:6,B:9},
      selectedStrategyId:"A",
    }]);
    expect(r.selectedVsOracleRegret).toBe(3);
  });
});
