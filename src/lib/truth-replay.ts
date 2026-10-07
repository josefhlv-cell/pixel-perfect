/**
 * Reality Investor — Point-in-Time Truth Replay.
 *
 * Selects only observations that were actually available at the forecast cutoff.
 * This prevents hindsight leakage when evaluating forecasts against official
 * transaction data that may be revised or published with delay.
 */

import type {TruthObservation} from "./truth-layer";

export interface TruthReplay {
  cutoff:string;
  usable:TruthObservation[];
  excludedFuture:number;
  excludedAfterCutoff:number;
  transactionObservations:number;
  replayReady:boolean;
}

export function replayTruth(
  observations:TruthObservation[],
  cutoff:string,
):TruthReplay{
  const cutoffMs=Date.parse(cutoff);
  const usable=observations.filter(o=>
    Date.parse(o.availableAt)<=cutoffMs &&
    Date.parse(o.eventTime)<=cutoffMs
  );
  const excludedFuture=observations.filter(o=>Date.parse(o.eventTime)>cutoffMs).length;
  const excludedAfterCutoff=observations.filter(o=>
    Date.parse(o.eventTime)<=cutoffMs&&Date.parse(o.availableAt)>cutoffMs
  ).length;
  const transactionObservations=usable.filter(o=>o.truthLevel==="TRANSACTION").length;
  return {
    cutoff,
    usable,
    excludedFuture,
    excludedAfterCutoff,
    transactionObservations,
    replayReady:usable.length>0,
  };
}
