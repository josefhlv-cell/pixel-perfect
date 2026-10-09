/**
 * Reality Investor — Deal Counterfactual Lab.
 *
 * Finds the smallest changes that would flip an investment decision.
 * This is decision sensitivity, not a claim that the intervention itself
 * will occur.
 */

export type DealAction="BUY_NOW"|"NEGOTIATE"|"WAIT"|"PASS";
export interface DealState {
  price:number; fairValue:number; expectedReturn:number; downside:number;
  confidence:number; liquidity:number; modelRisk:number;
}
export interface Counterfactual {
  variable:"PRICE"|"FAIR_VALUE"|"EXPECTED_RETURN"|"DOWNSIDE"|"CONFIDENCE"|"LIQUIDITY";
  direction:"UP"|"DOWN";
  change:number;
  resultingAction:DealAction;
  thresholdReached:boolean;
}
export interface CounterfactualLab {
  currentAction:DealAction;
  switchPoints:Counterfactual[];
  marginToSwitch:number;
  fragile:boolean;
}

function action(s:DealState):DealAction {
  const margin=(s.fairValue-s.price)/Math.max(1,s.price);
  const utility=s.expectedReturn-s.modelRisk*.25+s.liquidity*.03+s.confidence*.02;
  if(s.modelRisk>.65||s.confidence<.25)return "PASS";
  if(margin>=.15&&utility>=.08)return "BUY_NOW";
  if(margin>=.08&&utility>=.03)return "NEGOTIATE";
  if(utility>=0)return "WAIT";
  return "PASS";
}

export function counterfactualLab(base:DealState,steps=40):CounterfactualLab {
  const current=action(base);
  const switchPoints:Counterfactual[]=[];
  const variables:Counterfactual["variable"][]=["PRICE","FAIR_VALUE","EXPECTED_RETURN","DOWNSIDE","CONFIDENCE","LIQUIDITY"];

  for(const variable of variables){
    for(const direction of ["UP","DOWN"] as const){
      for(let i=1;i<=steps;i++){
        const change=i/steps*.5;
        const s={...base};
        const sign=direction==="UP"?1:-1;
        if(variable==="PRICE")s.price*=1+sign*change;
        if(variable==="FAIR_VALUE")s.fairValue*=1+sign*change;
        if(variable==="EXPECTED_RETURN")s.expectedReturn+=sign*change*.5;
        if(variable==="DOWNSIDE")s.downside+=sign*change*.5;
        if(variable==="CONFIDENCE")s.confidence=Math.max(0,Math.min(1,s.confidence+sign*change));
        if(variable==="LIQUIDITY")s.liquidity=Math.max(0,Math.min(1,s.liquidity+sign*change));
        const next=action(s);
        if(next!==current){
          switchPoints.push({variable,direction,change,resultingAction:next,thresholdReached:true});
          break;
        }
      }
    }
  }

  const margin=(base.fairValue-base.price)/Math.max(1,base.price);
  const marginToSwitch=Math.max(0,Math.min(.5,margin));
  return {currentAction:current,switchPoints,marginToSwitch,fragile:switchPoints.length<2};
}
