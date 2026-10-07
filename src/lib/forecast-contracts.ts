/**
 * Reality Investor — forecast registry and falsifiable contracts.
 *
 * Each published forecast gets a timestamp, data cutoff, expected distribution,
 * decision window and explicit invalidation rules.
 */

export interface ForecastContract{
  id:string;
  createdAt:string;
  dataCutoff:string;
  geography:string;
  horizonMonths:number;
  target:string;
  p10:number;
  p50:number;
  p90:number;
  probabilityPositive:number;
  confidence:number;
  modelVersion:string;
  baselineVersion:string;
  falsifiers:{metric:string;operator:"LT"|"LTE"|"GT"|"GTE";threshold:number}[];
}

export interface ContractAudit{
  status:"PENDING"|"ON_TRACK"|"VERIFIED"|"FAILED"|"INVALIDATED";
  realized:number|null;
  insideInterval:boolean|null;
  absoluteError:number|null;
  directionalHit:boolean|null;
  invalidatedBy:string[];
}

export function auditContract(
  contract:ForecastContract,
  realized:number|null,
  metrics:Record<string,number>,
):ContractAudit{
  const invalidated=contract.falsifiers.filter(r=>{
    const v=metrics[r.metric];
    if(v==null)return false;
    if(r.operator==="LT")return v<r.threshold;
    if(r.operator==="LTE")return v<=r.threshold;
    if(r.operator==="GT")return v>r.threshold;
    return v>=r.threshold;
  }).map(r=>r.metric);
  if(realized==null)return {status:invalidated.length?"INVALIDATED":"PENDING",realized:null,insideInterval:null,absoluteError:null,directionalHit:null,invalidatedBy:invalidated};
  const inside=realized>=contract.p10&&realized<=contract.p90;
  const direction=contract.p50>=0?realized>=0:realized<0;
  const status=invalidated.length?"INVALIDATED":inside?"VERIFIED":"FAILED";
  return {
    status,realized,insideInterval:inside,
    absoluteError:Math.abs(contract.p50-realized),
    directionalHit:direction,
    invalidatedBy:invalidated
  };
}
