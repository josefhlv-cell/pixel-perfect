/**
 * Reality Investor — Opportunity Radar.
 *
 * Looks for asymmetric situations: high upside probability, bounded downside,
 * strong model agreement and a concrete invalidation path.
 */

export interface OpportunityInput{
  id:string;
  probabilityGain:number;
  probabilityLargeGain:number;
  probabilityLargeLoss:number;
  expectedReturnBps:number;
  p10ReturnBps:number;
  p50ReturnBps:number;
  p90ReturnBps:number;
  confidence:number;
  agreement:number;
  liquidity:number;
  dataQuality:number;
  negotiationPotential:number;
}

export interface OpportunityScore{
  id:string;
  asymmetry:number;
  score:number;
  tier:"EXCEPTIONAL"|"STRONG"|"INTERESTING"|"NEUTRAL"|"AVOID";
  reasons:string[];
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

export function scoreOpportunity(x:OpportunityInput):OpportunityScore{
  const upside=Math.max(0,x.expectedReturnBps)/10000;
  const downside=Math.max(0,-x.p10ReturnBps)/10000;
  const asymmetry=clamp((x.probabilityGain*(1+upside*2))/(0.25+x.probabilityLargeLoss+downside*0.7),0,5);
  const score=clamp(
    (asymmetry*24+
      x.probabilityLargeGain*25+
      x.agreement*15+
      x.confidence*12+
      x.liquidity*8+
      x.dataQuality*8+
      x.negotiationPotential*8),0,100);
  const reasons:string[]=[];
  if(asymmetry>2.5)reasons.push("výnosový profil je výrazně asymetrický");
  if(x.agreement>.75)reasons.push("nezávislé modely se shodují");
  if(x.negotiationPotential>.65)reasons.push("existuje prostor pro vyjednání vstupní ceny");
  if(x.probabilityLargeLoss<.15)reasons.push("pravděpodobnost velkého poklesu je relativně nízká");
  if(x.dataQuality<.5)reasons.push("kvalita dat omezuje důvěru");
  const tier=score>=85?"EXCEPTIONAL":score>=72?"STRONG":score>=57?"INTERESTING":score>=40?"NEUTRAL":"AVOID";
  return {id:x.id,asymmetry,score,tier,reasons};
}
