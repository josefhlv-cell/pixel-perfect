/**
 * Reality Investor — Localized Forecast Uncertainty.
 *
 * Estimates uncertainty from nearby and feature-similar observations instead
 * of applying one global error radius. This is a lightweight governance layer
 * until a full spatial conformal model is trained on transaction data.
 */

export interface LocalObservation {
  id:string;
  lat:number;
  lon:number;
  featureVector:number[];
  residual:number;
  observedAt:string;
  sourceQuality:number;
}

export interface LocalUncertaintyInput {
  lat:number;
  lon:number;
  featureVector:number[];
  asOf:string;
  basePrediction:number;
}

export interface LocalUncertainty {
  radius:number;
  lower:number;
  upper:number;
  effectiveSampleSize:number;
  localityScore:number;
  freshnessScore:number;
  sourceScore:number;
  calibrationStatus:"LOCAL_STRUCTURAL"|"EMPIRICALLY_CALIBRATED";
  strongestEvidence:string[];
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

function geoDistanceKm(a:LocalObservation,b:LocalUncertaintyInput):number{
  const r=6371;
  const dLat=(b.lat-a.lat)*Math.PI/180;
  const dLon=(b.lon-a.lon)*Math.PI/180;
  const lat1=a.lat*Math.PI/180,lat2=b.lat*Math.PI/180;
  const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  return 2*r*Math.asin(Math.sqrt(h));
}

function featureDistance(a:number[],b:number[]):number{
  const n=Math.max(a.length,b.length);
  if(!n)return 1;
  let s=0,c=0;
  for(let i=0;i<n;i++){
    const d=(a[i]??0)-(b[i]??0);
    s+=d*d;c++;
  }
  return Math.sqrt(s/c);
}

function ageDays(date:string,asOf:string):number{
  const d=(Date.parse(asOf)-Date.parse(date))/86400000;
  return Math.max(0,d);
}

export function localizedUncertainty(
  observations:LocalObservation[],
  input:LocalUncertaintyInput,
  coverage=.90,
):LocalUncertainty{
  if(!observations.length){
    return {
      radius:Math.abs(input.basePrediction)*.25,
      lower:input.basePrediction*.75,
      upper:input.basePrediction*1.25,
      effectiveSampleSize:0,localityScore:0,freshnessScore:0,sourceScore:0,
      calibrationStatus:"LOCAL_STRUCTURAL",
      strongestEvidence:["Žádná lokální historická rezidua."]
    };
  }

  const weighted=observations.map(o=>{
    const km=geoDistanceKm(o,input);
    const fd=featureDistance(o.featureVector,input.featureVector);
    const freshness=Math.exp(-ageDays(o.observedAt,input.asOf)/365);
    const spatial=Math.exp(-km/5);
    const similarity=Math.exp(-fd);
    const weight=Math.max(.0001,spatial*.45+similarity*.40+freshness*.15);
    return {o,weight,km,fd,freshness};
  }).sort((a,b)=>b.weight-a.weight);

  const total=weighted.reduce((s,x)=>s+x.weight,0);
  const ess=total*total/Math.max(.0001,weighted.reduce((s,x)=>s+x.weight*x.weight,0));
  const residuals=weighted.flatMap(x=>Array.from({length:Math.max(1,Math.round(x.weight*10))},()=>Math.abs(x.o.residual)));
  residuals.sort((a,b)=>a-b);
  const q=residuals[Math.min(residuals.length-1,Math.floor(clamp(coverage,.5,.99)*(residuals.length-1)))] ?? Math.abs(input.basePrediction*.15);
  const radius=Math.max(q,Math.abs(input.basePrediction)*.01);
  const localityScore=clamp(weighted.slice(0,20).reduce((s,x)=>s+x.weight,0)/Math.max(.0001,total),0,1);
  const freshnessScore=clamp(weighted.slice(0,20).reduce((s,x)=>s+x.weight*x.freshness,0)/Math.max(.0001,weighted.slice(0,20).reduce((s,x)=>s+x.weight,0)),0,1);
  const sourceScore=clamp(weighted.reduce((s,x)=>s+x.weight*x.o.sourceQuality,0)/total,0,1);

  return {
    radius,lower:input.basePrediction-radius,upper:input.basePrediction+radius,
    effectiveSampleSize:ess,localityScore,freshnessScore,sourceScore,
    calibrationStatus:"LOCAL_STRUCTURAL",
    strongestEvidence:weighted.slice(0,3).map(x=>`${x.o.id}: ${x.km.toFixed(1)} km, feature-distance ${x.fd.toFixed(2)}`)
  };
}
