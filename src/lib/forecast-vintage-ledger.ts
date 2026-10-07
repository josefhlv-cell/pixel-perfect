/**
 * Reality Investor — Forecast Vintage Ledger.
 *
 * A forecast must be reproducible from the exact information vintage that was
 * available when it was issued. Later revisions must not silently rewrite history.
 */

export interface DataVintage {
  id:string;
  source:string;
  series:string;
  referencePeriod:string;
  publishedAt:string;
  revisionAt?:string;
  value:number;
  revision:number;
}

export interface ForecastVintage {
  id:string;
  forecastedAt:string;
  cutoff:string;
  datasetVersion:string;
  observationIds:string[];
  sourceVintages:string[];
  modelVersion:string;
  reproducibilityKey:string;
}

export interface VintageAudit {
  valid:boolean;
  futureInformation:number;
  missingVintage:number;
  duplicateObservationIds:number;
  audit:string[];
}

function hash32(input:string):string{
  let h=2166136261;
  for(let i=0;i<input.length;i++){
    h^=input.charCodeAt(i);
    h=Math.imul(h,16777619);
  }
  return (h>>>0).toString(16).padStart(8,"0");
}

export function buildForecastVintage(
  forecastedAt:string,
  cutoff:string,
  datasetVersion:string,
  observationIds:string[],
  vintages:DataVintage[],
  modelVersion:string,
):ForecastVintage{
  const cutoffMs=Date.parse(cutoff);
  const eligible=vintages.filter(v=>Date.parse(v.publishedAt)<=cutoffMs);
  const sourceVintages=[...new Set(eligible.map(v=>v.id))].sort();
  const key=hash32([
    forecastedAt,cutoff,datasetVersion,modelVersion,
    [...observationIds].sort().join(","),
    sourceVintages.join(","),
  ].join("|"));

  return {
    id:"fv-"+key,
    forecastedAt,cutoff,datasetVersion,
    observationIds:[...new Set(observationIds)].sort(),
    sourceVintages,
    modelVersion,
    reproducibilityKey:key,
  };
}

export function auditForecastVintage(
  forecast:ForecastVintage,
  vintages:DataVintage[],
):VintageAudit{
  const cutoffMs=Date.parse(forecast.cutoff);
  const futureInformation=vintages.filter(v=>Date.parse(v.publishedAt)>cutoffMs).length;
  const ids=new Set(forecast.sourceVintages);
  const missingVintage=forecast.sourceVintages.filter(id=>!ids.has(id)).length;
  const duplicates=forecast.observationIds.length-
    new Set(forecast.observationIds).size;

  return {
    valid:futureInformation===0&&missingVintage===0&&duplicates===0,
    futureInformation,
    missingVintage,
    duplicateObservationIds:duplicates,
    audit:[
      "Forecasts must reference immutable data vintages.",
      "Later revisions are new vintages, not mutations of historical forecast inputs.",
      "A reproducibility key identifies the exact forecast information set.",
    ],
  };
}
