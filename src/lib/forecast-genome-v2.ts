/**
 * Reality Investor — Forecast Genome 2.
 *
 * Turns forecast history into a contextual skill surface:
 * model × submarket × regime × horizon. This is descriptive empirical
 * performance; it becomes routing evidence only after sufficient OOS cases.
 */

export interface GenomeOutcome {
  model:string;
  submarket:string;
  regime:string;
  horizonMonths:number;
  error:number;
  directionalHit:boolean;
  calibrated:boolean;
  weight:number;
}

export interface SkillCell {
  model:string;
  submarket:string;
  regime:string;
  horizonMonths:number;
  cases:number;
  weightedError:number;
  directionalAccuracy:number;
  calibrationRate:number;
  trust:number;
  status:"CHAMPION_ZONE"|"CORE_ZONE"|"LEARNING_ZONE"|"INSUFFICIENT_DATA";
}

export interface LearningTarget { context:string; priority:number; reason:string; }\n\nexport interface ForecastGenomeV2 {
  cells:SkillCell[];
  bestByContext:Record<string,string>;
  fragileContexts:string[];
}

const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));

export function buildForecastGenomeV2(
  outcomes:GenomeOutcome[],
  minCases=20,
):ForecastGenomeV2{
  const keys=[...new Set(outcomes.map(o=>
    [o.model,o.submarket,o.regime,String(o.horizonMonths)].join("|")
  ))];

  const cells=keys.map(key=>{
    const p=key.split("|");
    const model=p[0]??"",submarket=p[1]??"",regime=p[2]??"";
    const horizonMonths=Number(p[3]??0);
    const group=outcomes.filter(o=>
      o.model===model&&o.submarket===submarket&&
      o.regime===regime&&o.horizonMonths===horizonMonths
    );
    const weightSum=group.reduce((s,o)=>s+Math.max(.01,o.weight),0)||1;
    const error=group.reduce((s,o)=>s+o.error*Math.max(.01,o.weight),0)/weightSum;
    const directional=group.reduce((s,o)=>s+(o.directionalHit?o.weight:0),0)/weightSum;
    const calibration=group.reduce((s,o)=>s+(o.calibrated?o.weight:0),0)/weightSum;
    const sample=clamp(group.length/minCases,0,1);
    const trust=clamp(
      (.45*(1-clamp(error,0,1))+.3*directional+.25*calibration)*sample,
      0,1
    );
    return {
      model,submarket,regime,horizonMonths,cases:group.length,
      weightedError:error,directionalAccuracy:directional,
      calibrationRate:calibration,trust,
      status:group.length<minCases
        ?"INSUFFICIENT_DATA"
        :trust>=.75
          ?"CHAMPION_ZONE"
          :trust>=.55
            ?"CORE_ZONE"
            :"LEARNING_ZONE",
    };
  });

  const bestByContext:Record<string,string>={};
  for(const cell of cells){
    if(cell.status==="INSUFFICIENT_DATA")continue;
    const key=[cell.submarket,cell.regime,cell.horizonMonths].join("|");
    const old=cells.find(x=>x.model===bestByContext[key]&&
      x.submarket===cell.submarket&&x.regime===cell.regime&&
      x.horizonMonths===cell.horizonMonths);
    if(!old||cell.trust>old.trust)bestByContext[key]=cell.model;
  }

  const fragileContexts=cells
    .filter(c=>c.status==="LEARNING_ZONE"&&c.cases>=Math.max(5,Math.floor(minCases/2)))
    .map(c=>[c.model,c.submarket,c.regime,c.horizonMonths].join("|"));

  const learningTargets=cells\n    .filter(c=>c.status==="INSUFFICIENT_DATA"||c.status==="LEARNING_ZONE")\n    .map(c=>({\n      context:[c.submarket,c.regime,c.horizonMonths].join("|"),\n      priority:clamp((1-c.trust)*.6+(1-c.calibrationRate)*.2+(1-c.directionalAccuracy)*.2,0,1),\n      reason:c.status==="INSUFFICIENT_DATA"?"Need more OOS outcomes":"Observed contextual weakness",\n    }))\n    .sort((a,b)=>b.priority-a.priority)\n    .slice(0,12);\n\n  return {cells,bestByContext,fragileContexts,learningTargets};
}
