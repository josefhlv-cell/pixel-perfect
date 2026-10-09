/**
 * Reality Investor — Opportunity Frontier.
 *
 * Instead of collapsing risk, return, liquidity and confidence into one opaque
 * score, expose the Pareto frontier. A deal is frontier-efficient when no
 * alternative dominates it on every important dimension.
 */

export interface OpportunityPoint {
  id:string;
  expectedReturnBps:number;
  downsideBps:number;
  liquidity:number;
  confidence:number;
  negotiationEdgeBps:number;
}

export interface FrontierPoint extends OpportunityPoint {
  frontier:boolean;
  dominatedBy:string[];
}

function dominates(a:OpportunityPoint,b:OpportunityPoint){
  const noWorse=
    a.expectedReturnBps>=b.expectedReturnBps &&
    a.downsideBps>=b.downsideBps &&
    a.liquidity>=b.liquidity &&
    a.confidence>=b.confidence &&
    a.negotiationEdgeBps>=b.negotiationEdgeBps;
  const better=
    a.expectedReturnBps>b.expectedReturnBps ||
    a.downsideBps>b.downsideBps ||
    a.liquidity>b.liquidity ||
    a.confidence>b.confidence ||
    a.negotiationEdgeBps>b.negotiationEdgeBps;
  return noWorse&&better;
}

export function opportunityFrontier(points:OpportunityPoint[]):FrontierPoint[]{
  return points.map(point=>{
    const dominatedBy=points.filter(x=>x.id!==point.id&&dominates(x,point)).map(x=>x.id);
    return {...point,frontier:dominatedBy.length===0,dominatedBy};
  });
}
