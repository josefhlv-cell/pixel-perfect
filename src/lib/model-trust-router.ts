export type TrustStatus="CHAMPION"|"CORE"|"BACKUP"|"DISABLED";
export interface ModelTrustCandidate { model:string; genomeScore:number; regimeScore:number; submarketScore:number; recencyTrust:number; evidenceQuality:number; driftPenalty:number; sampleSize:number; }
export interface RoutedModel { model:string; trust:number; weight:number; status:TrustStatus; }
export function routeModelTrust(candidates:ModelTrustCandidate[],minSamples=8):RoutedModel[]{
 const raw=candidates.map(c=>({model:c.model,trust:Math.max(0,Math.min(1,(c.genomeScore*.3+c.regimeScore*.2+c.submarketScore*.2+c.recencyTrust*.15+c.evidenceQuality*.15)*(c.sampleSize<minSamples?.35:1)*(1-Math.min(.85,c.driftPenalty)))),weight:0,status:"BACKUP" as TrustStatus}));
 const total=raw.reduce((s,x)=>s+x.trust,0)||1; raw.forEach(x=>x.weight=x.trust/total); raw.sort((a,b)=>b.trust-a.trust); raw.forEach((x,i)=>x.status=x.trust<.2?"DISABLED":i===0?"CHAMPION":i<3?"CORE":"BACKUP"); return raw;
}
