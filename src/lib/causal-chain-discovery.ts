/**
 * Causal Chain Discovery Engine
 *
 * Builds candidate multi-step mechanisms from the structural market graph and
 * scores them against lagged observations. It also exposes the weakest link
 * and bottleneck so the Future OS can tell the user what to watch next.
 *
 * Structural edges are hypotheses; empirical support is never treated as proof
 * of causality without point-in-time and out-of-sample validation.
 */
import {DEFAULT_CAUSAL_EDGES,type NodeId} from "./causal-market-graph";

export interface ChainObservation{node:NodeId;time:string;value:number;}
export interface CausalChainCandidate{
 id:string;nodes:NodeId[];mechanisms:string[];lagMonths:number;
 structuralEffect:number;empiricalSupport:number;contradiction:number;
 confidence:number;weakestLink:NodeId|null;status:"HYPOTHESIS"|"PROMISING"|"RESEARCH"|"REJECTED";
}
export interface CausalChainReport{
 chains:CausalChainCandidate[];best:CausalChainCandidate|null;
 bottleneck:{from:NodeId;to:NodeId;support:number}|null;
 audit:string[];
}

const clamp=(x:number,a=0,b=1)=>Math.min(b,Math.max(a,x));
const pearson=(a:number[],b:number[])=>{
 if(a.length<3||a.length!==b.length)return 0;
 const ma=a.reduce((s,x)=>s+x,0)/a.length,mb=b.reduce((s,x)=>s+x,0)/b.length;
 const num=a.reduce((s,x,i)=>s+(x-ma)*(b[i]!-mb),0);
 const da=Math.sqrt(a.reduce((s,x)=>s+(x-ma)**2,0)),db=Math.sqrt(b.reduce((s,x)=>s+(x-mb)**2,0));
 return da&&db?num/(da*db):0;
};
const shift=(xs:ChainObservation[],node:NodeId)=>{
 const a=xs.filter(x=>x.node===node).sort((p,q)=>Date.parse(p.time)-Date.parse(q.time));
 return a.map(x=>({time:Date.parse(x.time),value:x.value}));
};
function lagCorrelation(xs:ChainObservation[],from:NodeId,to:NodeId,lagMonths:number){
 const a=shift(xs,from),b=shift(xs,to),ys:number[]=[],zs:number[]=[];
 for(const x of a){
  const target=b.find(y=>Math.abs(y.time-(x.time+lagMonths*30.44*86400000))<16*86400000);
  if(target){ys.push(x.value);zs.push(target.value);}
 }
 return pearson(ys,zs);
}
function chainsFrom(node:NodeId,target:NodeId,depth=0,path:NodeId[]=[node]):NodeId[][]{
 if(depth>4)return [];
 if(node===target)return [path];
 const next=DEFAULT_CAUSAL_EDGES.filter(e=>e.from===node&&!path.includes(e.to));
 return next.flatMap(e=>chainsFrom(e.to,target,depth+1,[...path,e.to]));
}

export function discoverCausalChains(observations:ChainObservation[],from:NodeId,target:NodeId):CausalChainReport{
 const chains=chainsFrom(from,target),out:CausalChainCandidate[]=[];
 const linkSupports:{from:NodeId;to:NodeId;support:number}[]=[];
 for(const nodes of chains){
  const edges=nodes.slice(0,-1).map((n,i)=>DEFAULT_CAUSAL_EDGES.find(e=>e.from===n&&e.to===nodes[i+1])!);
  const empirical=edges.map(e=>Math.abs(lagCorrelation(observations,e.from,e.to,e.lagMonths)));
  const signed=edges.map((e,i)=>lagCorrelation(observations,e.from,e.to,e.lagMonths)*e.sign);
  edges.forEach((e,i)=>linkSupports.push({from:e.from,to:e.to,support:empirical[i]??0}));
  const empiricalSupport=empirical.length?empirical.reduce((s,x)=>s+x,0)/empirical.length:0;
  const contradiction=clamp(signed.filter(x=>x<0).length/Math.max(1,signed.length));
  const structuralEffect=edges.reduce((s,e)=>s*e.sign*e.strength,1);
  const weakestIndex=empirical.reduce((mi,v,i)=>v<(empirical[mi]??Infinity)?i:mi,0);
  const confidence=clamp(.30*clamp(empiricalSupport)+.25*(1-contradiction)+
    .20*clamp(Math.abs(structuralEffect))+.15*clamp(observations.length/200)+
    .10*clamp(1-(weakestIndex/Math.max(1,edges.length))));
  const status=observations.length<30?"HYPOTHESIS":confidence>=.72?"PROMISING":confidence>=.45?"RESEARCH":"REJECTED";
  out.push({
   id:`CHAIN:${nodes.join(">")}`,nodes,mechanisms:edges.map(e=>e.mechanism),
   lagMonths:edges.reduce((s,e)=>s+e.lagMonths,0),structuralEffect,empiricalSupport,contradiction,
   confidence,weakestLink:edges[weakestIndex]?.from??null,status
  });
 }
 out.sort((a,b)=>b.confidence-a.confidence);
 linkSupports.sort((a,b)=>a.support-b.support);
 return{chains:out,best:out[0]??null,bottleneck:linkSupports[0]??null,audit:[
  "Causal edges remain structural hypotheses until empirical validation.",
  "Lagged relationships are evaluated chronologically, not contemporaneously.",
  "Contradictory signed relationships reduce confidence.",
  "The weakest link and lowest-support edge are surfaced for targeted research.",
  "Production use requires point-in-time and out-of-sample validation."
 ]};
}
