/**
 * Prediction Audit — turns every forecast into a falsifiable contract.
 */

export interface PredictionContract {
  id:string;
  createdAt:string;
  targetDate:string;
  targetMetric:string;
  predictedP50:number;
  predictedP10:number;
  predictedP90:number;
  probability:number;
  confidence:number;
  regime:string;
  assumptions:string[];
  invalidators:string[];
}

export interface AuditResult {
  status:"ON_TRACK"|"EARLY_WARNING"|"FAILED"|"VERIFIED";
  errorPct:number;
  within90:boolean;
  calibrationContribution:number;
  lesson:string;
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

export function auditPrediction(contract:PredictionContract,actual:number):AuditResult{
  const errorPct=(actual-contract.predictedP50)/Math.max(1,Math.abs(contract.predictedP50))*100;
  const within90=actual>=contract.predictedP10&&actual<=contract.predictedP90;
  const tolerance=Math.max(0.03,Math.abs(contract.predictedP90-contract.predictedP10)/Math.max(1,Math.abs(contract.predictedP50))*0.20);
  const status=Math.abs(errorPct)<=tolerance*100
    ?"VERIFIED"
    :within90
      ?"ON_TRACK"
      :"FAILED";
  const calibrationContribution=within90?1:0;
  const lesson=status==="VERIFIED"
    ?"Predikce byla v očekávaném intervalu."
    :status==="ON_TRACK"
      ?"Predikce minula střed, ale nejistota byla správně široká."
      :"Model musí upravit bias, režim nebo šířku intervalů.";
  return {status,errorPct,within90,calibrationContribution,lesson};
}

export function confidenceAfterAudit(
  oldConfidence:number,
  recentAudits:AuditResult[],
  currentDriftBps:number
){
  if(!recentAudits.length)return oldConfidence;
  const coverage=recentAudits.filter(x=>x.within90).length/recentAudits.length;
  const failure=recentAudits.filter(x=>x.status==="FAILED").length/recentAudits.length;
  const driftPenalty=clamp(currentDriftBps/10000,0,0.45);
  return clamp(oldConfidence*(0.65+0.35*coverage)*(1-0.65*failure)*(1-driftPenalty),0.03,0.97);
}
