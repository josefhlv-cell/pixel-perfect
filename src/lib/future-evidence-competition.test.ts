import {competeFutureExplanations} from "./future-evidence-competition";

describe("future evidence competition",()=>{
 it("does not declare a winner when explanations are too close",()=>{
  const r=competeFutureExplanations(
   [{id:"1",family:"credit",direction:"UP",strength:.8,observedAt:"2026-01-01",independentGroup:"credit"}],
   [
    {id:"a",prior:.5,expected:[{family:"credit",direction:"UP",weight:1}],invalidators:[]},
    {id:"b",prior:.5,expected:[{family:"credit",direction:"UP",weight:.98}],invalidators:[]},
   ]
  );
  expect(r.unresolved).toBe(true);
  expect(r.winner).toBeNull();
 });
});