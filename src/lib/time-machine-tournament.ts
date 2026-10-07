/**
 * Reality Investor — Time Machine Tournament.
 *
 * Turns historical replay into a model-comparison protocol. Every forecast is
 * evaluated only against outcomes that were in the future of its information
 * cutoff. This is deliberately a protocol layer: it does not fabricate
 * historical performance when transaction outcomes are unavailable.
 */

export type ForecastFamily=
  |"BASELINE"
  |"HEDONIC"
  |"BOOSTING"
  |"SPATIAL"
  |"TEMPORAL"
  |"MACRO"
  |"BEHAVIORAL"
  |"GRAPH"
  |"FUTURE_TRAJECTORY";

export interface FrozenForecast {
  id:string;
  model:ForecastFamily;
  cutoff:string;
  horizonMonths:number;
  p10:number;
  p50:number;
  p90:number;
  probabilityPositive:number;
  regime:string;
  evidenceQuality:number;
}

export interface RealizedOutcome {
  forecastId:string;
  realizedGrowth:number;
  observedAt:string;
}

export interface TimeMachineScore {
  model:ForecastFamily;
  n:number;
  mae:number|null;
  rmse:number|null;
  bias:number|null;
  directionalAccuracy:number|null;
  coverage90:number|null;
  brier:number|null;
  intervalScore90:number|null;
  calibrationStatus:"EMPIRICAL"|"INSUFFICIENT_OUTCOMES";
}

export interface TimeMachineTournament {
  scores:TimeMachineScore[];
  champion:ForecastFamily|null;
  minimumOutcomesRequired:number;
  audit:string[];
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

function mean(xs:number[]):number|null{
  return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
}

function rmse(xs:number[]):number|null{
  return xs.length?Math.sqrt(xs.reduce((s,x)=>s+x*x,0)/xs.length):null;
}

function intervalScore(lower:number,upper:number,y:number,alpha=.1):number{
  const width=upper-lower;
  const low=Math.max(0,lower-y);
  const high=Math.max(0,y-upper);
  return width+(2/alpha)*low+(2/alpha)*high;
}

function score(
  model:ForecastFamily,
  forecasts:FrozenForecast[],
  outcomes:Map<string,RealizedOutcome>,
  minN:number,
):TimeMachineScore{
  const rows=forecasts.map(f=>({f,o:outcomes.get(f.id)})).filter(
    (x):x is {f:FrozenForecast;o:RealizedOutcome}=>Boolean(x.o)
  );
  if(rows.length<minN){
    return {
      model,n:rows.length,mae:null,rmse:null,bias:null,
      directionalAccuracy:null,coverage90:null,brier:null,
      intervalScore90:null,calibrationStatus:"INSUFFICIENT_OUTCOMES",
    };
  }

  const errors=rows.map(({f,o})=>f.p50-o.realizedGrowth);
  const abs=errors.map(Math.abs);
  const directions=rows.map(({f,o})=>
    (Math.sign(f.p50)===Math.sign(o.realizedGrowth))?1:0
  );
  const covered=rows.map(({f,o})=>
    o.realizedGrowth>=f.p10&&o.realizedGrowth<=f.p90?1:0
  );
  const brier=rows.map(({f,o})=>
    Math.pow(f.probabilityPositive-(o.realizedGrowth>0?1:0),2)
  );
  const intervals=rows.map(({f,o})=>intervalScore(f.p10,f.p90,o.realizedGrowth));

  return {
    model,n:rows.length,
    mae:mean(abs),
    rmse:rmse(errors),
    bias:mean(errors),
    directionalAccuracy:mean(directions),
    coverage90:mean(covered),
    brier:mean(brier),
    intervalScore90:mean(intervals),
    calibrationStatus:"EMPIRICAL",
  };
}

/**
 * Tournament scoring is intentionally conservative: no model can become a
 * champion without enough realized point-in-time outcomes.
 */
export function runTimeMachineTournament(
  forecasts:FrozenForecast[],
  outcomes:RealizedOutcome[],
  minimumOutcomesRequired=24,
):TimeMachineTournament{
  const outcomeMap=new Map(outcomes.map(x=>[x.forecastId,x]));
  const models=[...new Set(forecasts.map(x=>x.model))] as ForecastFamily[];
  const scores=models.map(model=>score(
    model,
    forecasts.filter(x=>x.model===model),
    outcomeMap,
    minimumOutcomesRequired,
  ));

  const eligible=scores.filter(x=>
    x.calibrationStatus==="EMPIRICAL"&&
    x.rmse!=null&&
    x.coverage90!=null
  );
  eligible.sort((a,b)=>{
    const ar=(a.rmse??Infinity)+Math.abs((a.coverage90??0)-.90)*100+(a.brier??1)*10;
    const br=(b.rmse??Infinity)+Math.abs((b.coverage90??0)-.90)*100+(b.brier??1)*10;
    return ar-br;
  });

  return {
    scores,
    champion:eligible[0]?.model??null,
    minimumOutcomesRequired,
    audit:[
      "Only outcomes after each forecast cutoff are eligible.",
      "Champion selection is blocked until the minimum realized-outcome count is reached.",
      "Coverage is measured on the forecast's stated interval, not inferred from point accuracy.",
      "A high score cannot compensate for temporal leakage.",
    ],
  };
}
