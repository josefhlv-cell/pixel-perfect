/**
 * Future Scenario Stack — base, bull, bear, stress and worst-plausible paths.
 * Probabilities are scenario weights, not calibrated frequencies.
 */
export type ScenarioPath="BASE"|"BULL"|"BEAR"|"STRESS"|"WORST_PLAUSIBLE";
export interface ScenarioInput{growth:number;rentGrowth:number;liquidity:number;inventory:number;rateChange:number;confidence:number;}
export interface ScenarioCase{path:ScenarioPath;weight:number;growth:number;rentGrowth:number;liquidity:number;decision:string;triggers:string[];}
export function buildFutureScenarioStack(x:ScenarioInput):ScenarioCase[]{
 const raw=[
  {path:"BASE" as const,w:.40,g:x.growth,r:x.rentGrowth,l:x.liquidity,d:"FOLLOW",t:["trend persists","no regime break"]},
  {path:"BULL" as const,w:.18,g:x.growth+.055,r:x.rentGrowth+.025,l:Math.min(1,x.liquidity+.15),d:"BUY/NEGOTIATE",t:["rates ease","inventory contracts","credit improves"]},
  {path:"BEAR" as const,w:.18,g:x.growth-.055,r:x.rentGrowth-.015,l:Math.max(0,x.liquidity-.15),d:"WAIT/NEGOTIATE",t:["DOM rises","demand slows","price cuts spread"]},
  {path:"STRESS" as const,w:.16,g:x.growth-.10,r:x.rentGrowth-.03,l:Math.max(0,x.liquidity-.30),d:"PASS/WAIT",t:["credit shock","employment shock","forced selling"]},
  {path:"WORST_PLAUSIBLE" as const,w:.08,g:x.growth-.17,r:x.rentGrowth-.06,l:Math.max(0,x.liquidity-.45),d:"PASS",t:["regime break","liquidity freeze","model failure"]},
 ];
 const scale=raw.reduce((s,a)=>s+a.w,0)||1;
 return raw.map(a=>({...a,weight:a.w/scale}));
}
