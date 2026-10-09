/**
 * Prediction OS — uncertainty budget.
 *
 * Confidence is decomposed so the UI can explain why a forecast is or isn't
 * trustworthy. No single confidence number is allowed to hide weak data.
 */

export interface UncertaintyBudget{
  dataRisk:number;
  modelRisk:number;
  regimeRisk:number;
  driftRisk:number;
  disagreementRisk:number;
  liquidityRisk:number;
  totalRisk:number;
  confidence:number;
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

export function uncertaintyBudget(x:{
  dataQuality:number;
  modelConfidence:number;
  regimeTransitionRisk:number;
  driftBps:number;
  ensembleAgreement:number;
  liquidity:number;
}):UncertaintyBudget{
  const dataRisk=1-clamp(x.dataQuality,0,1);
  const modelRisk=1-clamp(x.modelConfidence,0,1);
  const regimeRisk=clamp(x.regimeTransitionRisk,0,1);
  const driftRisk=clamp(x.driftBps/10000,0,1);
  const disagreementRisk=1-clamp(x.ensembleAgreement,0,1);
  const liquidityRisk=1-clamp(x.liquidity,0,1);
  const totalRisk=clamp(
    0.24*dataRisk+
    0.22*modelRisk+
    0.18*regimeRisk+
    0.16*driftRisk+
    0.12*disagreementRisk+
    0.08*liquidityRisk,0,1);
  return {
    dataRisk,modelRisk,regimeRisk,driftRisk,disagreementRisk,liquidityRisk,
    totalRisk,
    confidence:clamp(1-totalRisk,0.02,0.98)
  };
}

export interface ForecastExplanation{
  headline:string;
  strongestEvidence:string[];
  contradictions:string[];
  unknowns:string[];
  invalidation:string[];
}

export function explainForecast(x:{
  direction:"UP"|"DOWN"|"FLAT";
  confidence:number;
  agreement:number;
  weakSignals:string[];
  regimeRisk:number;
  driftBps:number;
}):ForecastExplanation{
  const contradictions:string[]=[];
  const unknowns:string[]=[];
  const invalidation:string[]=[];
  if(x.agreement<0.55)contradictions.push("Predikční modely se významně rozcházejí.");
  if(x.regimeRisk>0.45)contradictions.push("Trh je blízko změny režimu.");
  if(x.driftBps>3000)unknowns.push("Současné podmínky se výrazně liší od tréninkového období.");
  if(x.weakSignals.length)unknowns.push("Některé modely mají nízkou historickou přesnost nebo pokrytí.");
  if(x.direction==="UP")invalidation.push("trvalé zhoršení financování nebo prudký růst nabídky");
  if(x.direction==="DOWN")invalidation.push("výrazné uvolnění financování nebo náhlý růst poptávky");
  if(x.direction==="FLAT")invalidation.push("silný makroekonomický nebo úvěrový šok");
  return {
    headline:x.confidence>0.72
      ?"Silný a relativně konzistentní predikční signál."
      :"Signál existuje, ale nejistota je významná.",
    strongestEvidence:x.weakSignals.length?["Důkazy existují, ale část modelů je slabá."]:["Více nezávislých modelů ukazuje stejným směrem."],
    contradictions,
    unknowns,
    invalidation
  };
}
