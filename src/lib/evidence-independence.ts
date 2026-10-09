/**
 * Evidence Independence Layer — prevents duplicated/copying sources from
 * masquerading as independent confirmation.
 */
export interface EvidenceItem{id:string;source:string;parentSource?:string;metric:string;publishedAt:string;weight:number;similarity?:number;}
export interface IndependenceGroup{root:string;members:string[];effectiveWeight:number;}
export function groupIndependentEvidence(items:EvidenceItem[]):IndependenceGroup[]{
 const groups=new Map<string,EvidenceItem[]>();
 for(const x of items){const root=x.parentSource??x.source;const a=groups.get(root)??[];a.push(x);groups.set(root,a);}
 return [...groups.entries()].map(([root,members])=>{
  const total=members.reduce((s,x)=>s+x.weight,0);
  const redundancy=members.reduce((s,x)=>s+(x.similarity??0),0)/Math.max(1,members.length);
  return {root,members:members.map(x=>x.id),effectiveWeight:total/(1+redundancy*Math.max(0,members.length-1))};
 });
}
export function independenceAdjustedScore(items:EvidenceItem[]):number{
 const groups=groupIndependentEvidence(items); const raw=groups.reduce((s,x)=>s+x.effectiveWeight,0);
 return raw/(1+Math.max(0,groups.length-1)*.05);
}
