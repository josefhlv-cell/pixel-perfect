/**
 * Reality Investor — Scientific Forecast Protocol.
 *
 * A forecast is only "scientifically supported" when it beats a baseline
 * out-of-sample, survives temporal/spatial validation, has calibrated
 * uncertainty, and its gains are not explained by leakage.
 */

export interface ModelEvidence{
  model:string;
  baseline:string;
  horizonMonths:number;
  oosScore:number;
  baselineScore:number;
  improvementPct:number;
  calibrationError:number;
  intervalCoverage:number;
  leakageIssues:number;
  driftScore:number;
  sampleSize:number;
}

export interface ScientificVerdict{
  status:"SUPPORTED"|"PROMISING"|"INSUFFICIENT_EVIDENCE"|"REJECTED";
  score:number;
  reasons:string[];
  requirements:string[];
}

export function scientificVerdict(x:ModelEvidence):ScientificVerdict{
  const reasons:string[]=[];
  const requirements:string[]=[];
  if(x.leakageIssues>0)reasons.push("Existuje leakage; výsledek nelze považovat za validní.");
  if(x.oosScore<=x.baselineScore)reasons.push("Model nepřekonal baseline mimo vzorek.");
  else reasons.push(`Model překonal baseline o ${x.improvementPct.toFixed(1)} %.`);
  if(x.calibrationError>.10)reasons.push("Pravděpodobnosti jsou nedostatečně kalibrované.");
  if(x.intervalCoverage<.82||x.intervalCoverage>.97)reasons.push("Intervalové pokrytí je mimo předem stanovené toleranční pásmo.");
  if(x.driftScore>.65)reasons.push("Distribuční drift je vysoký.");
  if(x.sampleSize<500)requirements.push("Potřebujeme větší OOS vzorek.");
  if(x.leakageIssues>0)requirements.push("Odstranit leakage a zopakovat celý test.");
  if(x.calibrationError>.10)requirements.push("Provést kalibraci a následný holdout test.");
  if(x.intervalCoverage<.82||x.intervalCoverage>.97)requirements.push("Znovu kalibrovat intervaly.");
  const score=Math.max(0,Math.min(100,
    (x.oosScore>x.baselineScore?35:0)+
    (x.calibrationError<=.10?25:0)+
    (x.intervalCoverage>=.82&&x.intervalCoverage<=.97?20:0)+
    (x.leakageIssues===0?20:0)));
  const status=x.leakageIssues>0?"REJECTED":
    score>=85&&x.sampleSize>=500?"SUPPORTED":
    score>=60?"PROMISING":"INSUFFICIENT_EVIDENCE";
  return {status,score,reasons,requirements};
}
