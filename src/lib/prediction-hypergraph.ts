/**
 * Reality Investor — dynamic property/market hypergraph.
 *
 * A hyperedge represents a relationship involving more than two entities:
 * e.g. neighborhood + transit + employer cluster + housing segment.
 * This is an architecture contract; learned weights belong to the future
 * training pipeline and must be validated out-of-sample.
 */

export type HyperNodeType="PROPERTY"|"MICROMARKET"|"CITY"|"TRANSIT"|"EMPLOYMENT_CLUSTER"|"SCHOOL"|"POLICY"|"MACRO";

export interface HyperNode{
  id:string;
  type:HyperNodeType;
  features:Record<string,number>;
}

export interface HyperEdge{
  id:string;
  nodeIds:string[];
  relation:string;
  weight:number;
  validFrom:string;
  validTo?:string;
}

export interface Hypergraph{
  nodes:HyperNode[];
  edges:HyperEdge[];
}

export interface HypergraphSignal{
  nodeId:string;
  exposure:number;
  neighbors:number;
  relationDiversity:number;
  temporalStability:number;
}

export function buildHypergraphSignal(graph:Hypergraph,nodeId:string,cutoff:string):HypergraphSignal{
  const active=graph.edges.filter(e=>e.nodeIds.includes(nodeId)&&Date.parse(e.validFrom)<=Date.parse(cutoff)&&(!e.validTo||Date.parse(e.validTo)>=Date.parse(cutoff)));
  const weights=active.map(e=>Math.abs(e.weight));
  const exposure=weights.reduce((a,b)=>a+b,0);
  const neighbors=new Set(active.flatMap(e=>e.nodeIds).filter(id=>id!==nodeId)).size;
  const relations=new Set(active.map(e=>e.relation)).size;
  const stability=active.length?active.filter(e=>!e.validTo||Date.parse(e.validTo)-Date.parse(e.validFrom)>180*86400000).length/active.length:0;
  return {nodeId,exposure,neighbors,relationDiversity:relations,temporalStability:stability};
}

export function graphConsensus(signals:HypergraphSignal[]){
  if(!signals.length)return {score:0,dispersion:0};
  const values=signals.map(s=>s.exposure/(1+s.neighbors));
  const mean=values.reduce((a,b)=>a+b,0)/values.length;
  const variance=values.reduce((s,x)=>s+(x-mean)**2,0)/values.length;
  return {score:mean,dispersion:Math.sqrt(variance)};
}
