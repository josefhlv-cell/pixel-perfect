export type ModelId="NAIVE"|"MOMENTUM"|"MEAN_REVERSION"|"INVENTORY_ADJUSTED"|"ENSEMBLE";
export interface ForecastCandidate{id:ModelId;prediction:number;lower:number;upper:number;confidence:number;}
export interface TournamentScore{id:ModelId;mae:number;coverage:number;directionAccuracy:number;score:number;}
export function scoreTournament(candidates:ForecastCandidate[],actual:number,previous?:number):TournamentScore[]{
 return candidates.map(c=>{const mae=Math.abs(c.prediction-actual);const covered=actual>=c.lower&&actual<=c.upper;
 const dir=previous===undefined?.5:(Math.sign(c.prediction-previous)===Math.sign(actual-previous)?1:0);
 return {id:c.id,mae,coverage:covered?1:0,directionAccuracy:dir,score:1/(1+mae)+.3*(covered?1:0)+.2*dir};}).sort((a,b)=>b.score-a.score);
}