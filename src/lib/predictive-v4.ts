export interface AnomalyResult {
  observedPriceM2:number;
  expectedPriceM2:number;
  residualBps:number;
  robustZ:number;
  probabilityUndervalued:number;
  probabilityOvervalued:number;
  confidence:number;
  label:"DEEP_VALUE"|"UNDERVALUED"|"FAIR"|"OVERVALUED"|"UNRELIABLE";
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

export function robustZScore(value:number,median:number,mad:number){
  return (value-median)/(1.4826*Math.max(mad,1));
}

export function detectAnomaly(observedPriceM2:number,expectedPriceM2:number,mad:number,sampleSize:number):AnomalyResult{
  const residualBps=(observedPriceM2/Math.max(expectedPriceM2,1)-1)*10000;
  const z=robustZScore(observedPriceM2,expectedPriceM2,mad);
  const p=1/(1+Math.exp(clamp(residualBps/950,-20,20)));
  const confidence=clamp(Math.min(1,sampleSize/50)*(1-Math.min(0.7,Math.abs(z)/20)),0.05,0.98);
  const label=confidence<0.35?"UNRELIABLE":z<=-3?"DEEP_VALUE":z<=-1.25?"UNDERVALUED":z>=1.25?"OVERVALUED":"FAIR";
  return {observedPriceM2,expectedPriceM2,residualBps,robustZ:z,probabilityUndervalued:p,probabilityOvervalued:1-p,confidence,label};
}

export function ensembleAgreement(predictions:number[]){
  if(predictions.length<2)return {dispersion:0,agreement:1};
  const mean=predictions.reduce((a,b)=>a+b,0)/predictions.length;
  const variance=predictions.reduce((s,x)=>s+(x-mean)**2,0)/predictions.length;
  const dispersion=Math.sqrt(variance)/Math.max(1,Math.abs(mean));
  return {dispersion,agreement:clamp(Math.exp(-dispersion*8),0,1)};
}

export function dataQualityScore(sampleSize:number,months:number,transactionShare:number,freshnessDays:number){
  return Math.round(100*(0.3*Math.min(1,sampleSize/500)+0.25*Math.min(1,months/36)+0.3*clamp(transactionShare,0,1)+0.15*(1-Math.min(1,freshnessDays/90))));
}