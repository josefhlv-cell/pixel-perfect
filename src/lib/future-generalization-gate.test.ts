import {evaluateFutureGeneralization} from "./future-generalization-gate";

describe("future generalization gate",()=>{
 it("rejects a model that only has weak joint future-space evidence",()=>{
  const r=evaluateFutureGeneralization([
   {modelId:"A",fold:"FUTURE_TIME",error:9,baselineError:10,coverage:.9,directionalAccuracy:.7,sampleSize:30},
   {modelId:"A",fold:"UNSEEN_REGION",error:10,baselineError:10,coverage:.9,directionalAccuracy:.6,sampleSize:30},
   {modelId:"A",fold:"FUTURE_AND_REGION",error:9.8,baselineError:10,coverage:.9,directionalAccuracy:.6,sampleSize:30},
  ]);
  expect(r.champion).toBeNull();
  expect(r.scores[0]?.status).not.toBe("CHAMPION");
 });
});
