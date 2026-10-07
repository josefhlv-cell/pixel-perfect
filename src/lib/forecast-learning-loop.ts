/**
 * Reality Investor — Forecast Learning Loop.
 *
 * Governs delayed feedback from Forecast Memory. A forecast becomes eligible
 * for learning only after its outcome horizon has matured and its outcome
 * quality passes the gate. Model trust is then updated using prequential skill,
 * calibration and recent regime-aware performance.
 */

export interface LearningCase {
  forecastId:string;
  modelId:string;
  issuedAt:string;
  outcomeAvailableAt:string;
  currentTime:string;
  score:number;
  calibrationScore:number;
  regime:string;
  submarket:string;
  outcomeQuality:number;
}

export interface ModelLearningState {
  modelId:string;
  casesUsed:number;
  recentScore:number;
  recentCalibration:number;
  regime:string;
  submarket:string;
  trust:number;
  status:"LEARNING"|"STABLE"|"INSUFFICIENT_FEEDBACK";
}

export interface LearningLoopResult {
  eligible:number;
  deferred:number;
  states:ModelLearningState[];
  updateReady:boolean;
  audit:string[];
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

export function runForecastLearningLoop(
  cases:LearningCase[],
  minCases=20,
):LearningLoopResult{
  const currentMs=Math.max(...cases.map(c=>Date.parse(c.currentTime)).filter(Number.isFinite),Date.now());
  const eligible=cases.filter(c=>
    Date.parse(c.outcomeAvailableAt)<=Date.parse(c.currentTime)&&
    c.outcomeQuality>=.6
  );
  const deferred=cases.length-eligible.length;

  const keys=[...new Set(eligible.map(c=>c.modelId+"|"+c.regime+"|"+c.submarket))];
  const states=keys.map(key=>{
    const parts=key.split("|");
    const modelId=parts[0]??"";
    const regime=parts[1]??"";
    const submarket=parts[2]??"";
    const group=eligible.filter(c=>
      c.modelId===modelId&&c.regime===regime&&c.submarket===submarket
    );

    // Exponential recency weighting: recent outcomes matter more, while
    // the exact half-life remains a governance parameter rather than a claim.
    const now=currentMs;
    let scoreNumerator=0,calNumerator=0,weightSum=0;
    for(const c of group){
      const ageDays=Math.max(0,(now-Date.parse(c.outcomeAvailableAt))/86400000);
      const w=Math.exp(-ageDays/365);
      scoreNumerator+=c.score*w;
      calNumerator+=c.calibrationScore*w;
      weightSum+=w;
    }
    const recentScore=weightSum?scoreNumerator/weightSum:0;
    const recentCalibration=weightSum?calNumerator/weightSum:0;
    const sampleFactor=clamp(group.length/minCases,0,1);
    const trust=clamp(
      .2+.5*recentScore+.3*recentCalibration,
      0,1
    )*sampleFactor;

    return {
      modelId,casesUsed:group.length,recentScore,recentCalibration,
      regime,submarket,trust,
      status:group.length<minCases
        ?"INSUFFICIENT_FEEDBACK"
        :trust>.7
          ?"STABLE"
          :"LEARNING",
    };
  });

  return {
    eligible:eligible.length,
    deferred,
    states,
    updateReady:states.some(s=>s.status!=="INSUFFICIENT_FEEDBACK"),
    audit:[
      "Feedback is delayed until the forecast horizon has matured.",
      "Low-quality outcomes cannot update model trust.",
      "Trust is contextual by model, regime and submarket.",
      "Recent evidence is weighted more strongly than stale evidence.",
    ],
  };
}
