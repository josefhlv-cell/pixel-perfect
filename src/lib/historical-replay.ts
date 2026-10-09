/**
 * Reality Investor — Historical Replay Engine.
 *
 * Reconstructs what the system would have known at a historical cutoff.
 * The replay intentionally excludes observations whose availability timestamp
 * was after the cutoff. This is the foundation for an honest "time machine"
 * benchmark of investment decisions.
 */

export interface ReplayObservation {
  id:string;
  eventTime:string;
  availableAt:string;
  value:number;
  kind:string;
  source:string;
}

export interface ReplayWindow {
  cutoff:string;
  horizonEnd:string;
  visible:ReplayObservation[];
  excludedFuture:ReplayObservation[];
}

export interface ReplayResult {
  cutoff:string;
  horizonMonths:number;
  visibleCount:number;
  excludedFutureCount:number;
  decision:string;
  predictedReturnBps:number;
  realizedReturnBps:number|null;
  forecastErrorBps:number|null;
}

export function replayInformation(
  observations:ReplayObservation[],
  cutoff:string,
):ReplayWindow{
  const t=Date.parse(cutoff);
  const visible=observations.filter(x=>Date.parse(x.availableAt)<=t);
  const excludedFuture=observations.filter(x=>Date.parse(x.availableAt)>t);
  return {cutoff,horizonEnd:cutoff,visible,excludedFuture};
}

export function buildReplayWindows(
  observations:ReplayObservation[],
  cutoffs:string[],
  horizonMonths=12,
):ReplayWindow[]{
  return cutoffs.map(cutoff=>replayInformation(observations,cutoff)).map(w=>{
    const end=new Date(Date.parse(w.cutoff));
    end.setMonth(end.getMonth()+horizonMonths);
    return {...w,horizonEnd:end.toISOString()};
  });
}

export function auditReplayLeakage(window:ReplayWindow){
  return window.visible.filter(x=>Date.parse(x.availableAt)>Date.parse(window.cutoff));
}

/**
 * A replay is considered scientifically valid only if no visible observation
 * was published after the cutoff. The actual model decision is deliberately
 * supplied by the caller so the engine can replay any model family.
 */
export function isReplayValid(window:ReplayWindow):boolean{
  return auditReplayLeakage(window).length===0;
}
