export type MarketState = {
  date: string;
  features: Record<string, number>;
};

export type HistoricalAnalog = {
  date: string;
  distance: number;
  similarity: number;
};

export function findHistoricalAnalogs(
  current: Record<string, number>,
  history: MarketState[],
  topN = 5,
): HistoricalAnalog[] {
  const keys=Object.keys(current);
  const scales=new Map<string,number>();
  for(const key of keys){
    const values=history.map(x=>Math.abs(x.features[key]??0));
    const scale=Math.max(1, ...values);
    scales.set(key,scale);
  }
  return history.map(state=>{
    let sum=0, weight=0;
    for(const key of keys){
      const a=current[key], b=state.features[key];
      if(!Number.isFinite(a)||!Number.isFinite(b)) continue;
      const s=scales.get(key)??1;
      sum+=((a!-b!)/s)**2;
      weight++;
    }
    const distance=weight?Math.sqrt(sum/weight):Infinity;
    return {date:state.date,distance,similarity:1/(1+distance)};
  }).sort((a,b)=>a.distance-b.distance).slice(0,topN);
}
