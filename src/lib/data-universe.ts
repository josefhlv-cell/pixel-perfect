/**
 * Reality Investor — Data Universe contract.
 *
 * Every observation has two clocks:
 * 1) eventTime: when reality happened
 * 2) availableAt: when the model could legitimately have known it
 *
 * Training and backtesting MUST use availableAt <= predictionCutoff.
 * This is the core defense against look-ahead bias.
 */

export type ObservationKind=
  |"TRANSACTION_PRICE"|"ASKING_PRICE"|"RENT"|"LISTING"|"WITHDRAWAL"
  |"MORTGAGE_RATE"|"POLICY_RATE"|"CREDIT"|"INCOME"|"EMPLOYMENT"
  |"POPULATION"|"CONSTRUCTION"|"PERMIT"|"MACRO"|"INFRASTRUCTURE"
  |"SEARCH_BEHAVIOR"|"SENTIMENT"|"DEMOGRAPHY";

export type TruthLevel="TRANSACTION"|"OBSERVED_MARKET"|"MODELLED"|"SCENARIO";

export interface Observation{
  id:string;
  kind:ObservationKind;
  geography:string;
  eventTime:string;
  availableAt:string;
  value:number;
  unit:string;
  source:string;
  sourceVersion?:string;
  truthLevel:TruthLevel;
  revision?:number;
  quality:number;
}

export interface PointInTimeDataset{
  cutoff:string;
  rows:Observation[];
  excludedFutureRows:number;
  revisionAware:boolean;
}

export function pointInTimeDataset(rows:Observation[],cutoff:string):PointInTimeDataset{
  const t=Date.parse(cutoff);
  const usable=rows.filter(r=>Date.parse(r.availableAt)<=t);
  return {
    cutoff,
    rows:usable,
    excludedFutureRows:rows.length-usable.length,
    revisionAware:usable.every(r=>r.availableAt<=r.eventTime||r.revision!=null)
  };
}

export function auditAvailability(rows:Observation[],cutoff:string){
  return rows.filter(r=>Date.parse(r.availableAt)>Date.parse(cutoff))
    .map(r=>({id:r.id,kind:r.kind,availableAt:r.availableAt,cutoff,severity:"HIGH" as const}));
}

export function sourceAdjustedWeight(row:Observation){
  const truth=row.truthLevel==="TRANSACTION"?1:row.truthLevel==="OBSERVED_MARKET"?.78:row.truthLevel==="MODELLED"?.45:.25;
  return Math.max(.01,Math.min(1,row.quality))*truth;
}
