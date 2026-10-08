export type SeriesPoint = { date: string; value: number };
export type MechanismCandidate = {
  sourceKey: string;
  targetKey: string;
  lagDays: number;
  correlation: number;
  directionalAccuracy: number;
  stability: number;
  incrementalValue: number;
  score: number;
  status: "CANDIDATE" | "PROMISING" | "REJECT";
};

function mean(v: number[]) { return v.length ? v.reduce((s,x)=>s+x,0)/v.length : 0; }
function corr(a: number[], b: number[]) {
  if (a.length < 3 || a.length !== b.length) return 0;
  const am=mean(a), bm=mean(b);
  const num=a.reduce((s,x,i)=>s+(x-am)*(b[i]-bm),0);
  const da=Math.sqrt(a.reduce((s,x)=>s+(x-am)**2,0));
  const db=Math.sqrt(b.reduce((s,x)=>s+(x-bm)**2,0));
  return da && db ? num/(da*db) : 0;
}
function aligned(source: SeriesPoint[], target: SeriesPoint[], lagDays: number) {
  const targetMap=new Map(target.map(p=>[new Date(p.date).toISOString().slice(0,10),p.value]));
  const a:number[]=[], b:number[]=[];
  for (const p of source) {
    const d=new Date(new Date(p.date).getTime()+lagDays*86_400_000).toISOString().slice(0,10);
    const v=targetMap.get(d);
    if (v != null) { a.push(p.value); b.push(v); }
  }
  return {a,b};
}
export function discoverMechanisms(
  sources: Record<string, SeriesPoint[]>,
  targets: Record<string, SeriesPoint[]>,
  lagsDays: number[] = [30,60,90,180,270,365],
): MechanismCandidate[] {
  const out: MechanismCandidate[]=[];
  for (const [sourceKey, source] of Object.entries(sources)) {
    for (const [targetKey, target] of Object.entries(targets)) {
      if (sourceKey===targetKey) continue;
      for (const lagDays of lagsDays) {
        const {a,b}=aligned(source,target,lagDays);
        if (a.length<10) continue;
        const correlation=corr(a,b);
        let directional=0;
        for(let i=1;i<a.length;i++) {
          const da=Math.sign(a[i]-a[i-1]);
          const db=Math.sign(b[i]-b[i-1]);
          if(da===db) directional++;
        }
        const directionalAccuracy=directional/Math.max(1,a.length-1);
        const chunk=Math.max(2,Math.floor(a.length/4));
        const windowCorr:number[]=[];
        for(let start=0;start<a.length;start+=chunk) {
          const aa=a.slice(start,start+chunk), bb=b.slice(start,start+chunk);
          if(aa.length>=3) windowCorr.push(Math.abs(corr(aa,bb)));
        }
        const stability=windowCorr.length ? windowCorr.filter(x=>x>=Math.abs(correlation)*0.5).length/windowCorr.length : 0;
        const incrementalValue=Math.max(0,Math.abs(correlation)-0.2)*stability;
        const score=Math.abs(correlation)*0.4+directionalAccuracy*0.25+stability*0.2+incrementalValue*0.15;
        const status=score>=0.7&&stability>=0.5?"PROMISING":score>=0.45?"CANDIDATE":"REJECT";
        out.push({sourceKey,targetKey,lagDays,correlation,directionalAccuracy,stability,incrementalValue,score,status});
      }
    }
  }
  return out.sort((a,b)=>b.score-a.score);
}
