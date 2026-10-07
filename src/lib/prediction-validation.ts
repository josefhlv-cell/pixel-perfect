/**
 * Reality Investor — honest validation and leakage defense.
 * Real-estate forecasts must be tested forward in time and, where possible,
 * on unseen spatial blocks. Random CV is not accepted as the primary score.
 */

export interface ValidationRecord {
  id:string;
  date:string;
  lat?:number|null;
  lon?:number|null;
  group?:string|null;
  actual:number;
}

export interface ValidationFold {
  fold:number;
  trainIds:string[];
  testIds:string[];
  cutoff:string;
  spatialBlocks:string[];
}

export interface LeakageIssue {
  recordId:string;
  feature:string;
  featureDate:string;
  predictionCutoff:string;
  severity:"HIGH"|"MEDIUM"|"LOW";
  reason:string;
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

function blockKey(r:ValidationRecord, blockSize=0.05):string{
  if(r.lat==null||r.lon==null) return r.group??"UNKNOWN";
  return `${Math.floor(r.lat/blockSize)}:${Math.floor(r.lon/blockSize)}`;
}

export function buildHonestFolds(
  records:ValidationRecord[],
  opts:{testHorizonMonths?:number;minTrainRecords?:number;spatialBlockSize?:number}={}
):ValidationFold[]{
  const sorted=[...records].sort((a,b)=>a.date.localeCompare(b.date));
  const horizon=opts.testHorizonMonths??12;
  const minTrain=opts.minTrainRecords??30;
  const folds:ValidationFold[]=[];
  for(let i=minTrain,fold=0;i<sorted.length;fold++){
    const cutoff=sorted[i]!.date;
    const cutoffTime=Date.parse(cutoff);
    const testEnd=new Date(cutoffTime); testEnd.setMonth(testEnd.getMonth()+horizon);
    const test=sorted.filter(r=>Date.parse(r.date)>=cutoffTime&&Date.parse(r.date)<testEnd.getTime());
    if(!test.length) break;
    const testBlocks=new Set(test.map(r=>blockKey(r,opts.spatialBlockSize??0.05)));
    const train=sorted.filter(r=>Date.parse(r.date)<cutoffTime&&!testBlocks.has(blockKey(r,opts.spatialBlockSize??0.05)));
    if(train.length>=minTrain){
      folds.push({fold,trainIds:train.map(r=>r.id),testIds:test.map(r=>r.id),cutoff,spatialBlocks:[...testBlocks]});
    }
    const nextIndex=sorted.findIndex(r=>Date.parse(r.date)>=testEnd.getTime());
    if(nextIndex<0) break;
    i=Math.max(i+1,nextIndex);
  }
  return folds;
}

export function auditTemporalLeakage(
  records:ValidationRecord[],
  featureDates:Record<string,Record<string,string|null|undefined>>,
):LeakageIssue[]{
  const out:LeakageIssue[]=[];
  for(const r of records){
    const features=featureDates[r.id]??{};
    for(const [feature,date] of Object.entries(features)){
      if(!date) continue;
      if(Date.parse(date)>Date.parse(r.date)){
        out.push({recordId:r.id,feature,featureDate:date,predictionCutoff:r.date,severity:"HIGH",reason:"Feature was observed after the prediction cutoff."});
      } else if(Date.parse(date)===Date.parse(r.date)){
        out.push({recordId:r.id,feature,featureDate:date,predictionCutoff:r.date,severity:"MEDIUM",reason:"Same-day feature may contain information published after the forecast timestamp."});
      }
    }
  }
  return out;
}

export function calibrationError(predictions:{probability:number;outcome:boolean}[],bins=10){
  if(!predictions.length)return {ece:1,brier:1,logLoss:1};
  let ece=0,brier=0,logLoss=0;
  for(const p of predictions){
    const q=clamp(p.probability,1e-6,1-1e-6);
    const y=p.outcome?1:0;
    brier+=(q-y)**2;
    logLoss+=-(y*Math.log(q)+(1-y)*Math.log(1-q));
  }
  for(let b=0;b<bins;b++){
    const lo=b/bins,hi=(b+1)/bins;
    const rows=predictions.filter(p=>p.probability>=lo&&p.probability<(b===bins-1?hi+1e-9:hi));
    if(!rows.length)continue;
    const avg=rows.reduce((s,p)=>s+p.probability,0)/rows.length;
    const hit=rows.filter(p=>p.outcome).length/rows.length;
    ece+=rows.length/predictions.length*Math.abs(avg-hit);
  }
  return {ece,brier:brier/predictions.length,logLoss:logLoss/predictions.length};
}
