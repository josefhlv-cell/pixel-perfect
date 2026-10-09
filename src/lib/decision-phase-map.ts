export type DecisionZone="BUY"|"NEGOTIATE"|"WAIT"|"PASS";
export interface PhasePoint { margin:number; modelRisk:number; confidence:number; action:DecisionZone; }
export interface PhaseMap { points:PhasePoint[]; boundaries:{buyMinMargin:number;passMaxRisk:number;waitMinConfidence:number}; }
export function buildDecisionPhaseMap():PhaseMap { const points:PhasePoint[]=[]; for(let m=-.2;m<=.4;m+=.02)for(let r=0;r<=1;r+=.05){const c=Math.max(0,1-r); const action:DecisionZone=m>=.15&&r<.35?"BUY":m>=.07&&r<.55&&c>.3?"NEGOTIATE":m>=0&&r<.8?"WAIT":"PASS"; points.push({margin:Number(m.toFixed(2)),modelRisk:Number(r.toFixed(2)),confidence:Number(c.toFixed(2)),action});} return {points,boundaries:{buyMinMargin:.15,passMaxRisk:.8,waitMinConfidence:.3}}; }
