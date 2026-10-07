/**
 * Prediction OS — information value and observation priorities.
 * Decides which missing data would most improve the forecast.
 */

export interface DataGap{
  factor:string;
  importance:number;
  currentQuality:number;
  expectedInformationGain:number;
  action:string;
}

export function prioritizeDataGaps(gaps:DataGap[]){
  return [...gaps]
    .map(g=>({...g,priority:g.importance*(1-g.currentQuality)*g.expectedInformationGain}))
    .sort((a,b)=>b.priority-a.priority);
}

export function nextBestObservation(gaps:DataGap[]){
  return prioritizeDataGaps(gaps)[0]??null;
}
