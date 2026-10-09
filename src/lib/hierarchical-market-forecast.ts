export interface HierarchyNode{level:"COUNTRY"|"REGION"|"CITY"|"DISTRICT"|"MICROMARKET"|"PROPERTY";id:string;growth:number;confidence:number;}
export interface HierarchicalForecast{property:number;micro:number;district:number;city:number;region:number;coherence:number;uncertainty:number;}
export function reconcileHierarchy(nodes:HierarchyNode[]):HierarchicalForecast{
 const pick=(level:HierarchyNode["level"])=>nodes.filter(n=>n.level===level).reduce((s,n)=>s+n.growth*n.confidence,0)/Math.max(.0001,nodes.filter(n=>n.level===level).reduce((s,n)=>s+n.confidence,0));
 const property=pick("PROPERTY"),micro=pick("MICROMARKET"),district=pick("DISTRICT"),city=pick("CITY"),region=pick("REGION");
 const vals=[property,micro,district,city,region],mean=vals.reduce((a,b)=>a+b,0)/vals.length;
 const uncertainty=Math.sqrt(vals.reduce((s,v)=>s+(v-mean)**2,0)/vals.length);
 return{property,micro,district,city,region,coherence:1-Math.min(1,uncertainty/Math.max(.01,Math.abs(mean))),uncertainty};
}