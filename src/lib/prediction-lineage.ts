/**
 * Prediction lineage — every forecast should be reproducible.
 * Stores what data, feature version, model ensemble and assumptions produced it.
 */

export interface DataSourceRef {
  source:string;
  version?:string;
  observedAt?:string;
  quality:number;
  rowCount?:number;
}

export interface FeatureLineage {
  name:string;
  version:string;
  inputs:string[];
  leakageChecked:boolean;
}

export interface PredictionLineage {
  predictionId:string;
  generatedAt:string;
  modelVersion:string;
  horizonMonths:number;
  dataSources:DataSourceRef[];
  features:FeatureLineage[];
  assumptions:string[];
  uncertainty:string[];
  reproducibilityKey:string;
}

function hash32(input:string):string{
  let h=2166136261;
  for(let i=0;i<input.length;i++){h^=input.charCodeAt(i);h=Math.imul(h,16777619);}
  return (h>>>0).toString(16).padStart(8,"0");
}

export function buildPredictionLineage(x:{
  predictionId:string;
  generatedAt:string;
  modelVersion:string;
  horizonMonths:number;
  dataSources:DataSourceRef[];
  features:FeatureLineage[];
  assumptions:string[];
  uncertainty:string[];
}):PredictionLineage{
  const canonical=JSON.stringify({
    predictionId:x.predictionId,modelVersion:x.modelVersion,horizonMonths:x.horizonMonths,
    dataSources:x.dataSources.map(d=>[d.source,d.version,d.observedAt,d.quality,d.rowCount]),
    features:x.features.map(f=>[f.name,f.version,f.inputs,f.leakageChecked]),
    assumptions:x.assumptions,uncertainty:x.uncertainty
  });
  return {...x,reproducibilityKey:hash32(canonical)};
}
