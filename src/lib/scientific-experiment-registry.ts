/**
 * Reality Investor — Scientific Experiment Registry.
 *
 * Every new modeling idea becomes a falsifiable experiment. This prevents
 * feature/model inflation: complexity is allowed only when it improves
 * out-of-sample evidence without violating integrity constraints.
 */

export type ExperimentVerdict =
  | "SUPPORTED"
  | "PROMISING"
  | "INSUFFICIENT_EVIDENCE"
  | "REJECTED";

export interface Experiment {
  id:string;
  hypothesis:string;
  baseline:string;
  treatment:string;
  target:string;
  split:string;
  createdAt:string;
}

export interface ExperimentResult {
  experimentId:string;
  modelVersion?:string;
  datasetVersion?:string;
  baselineScore:number;
  treatmentScore:number;
  delta:number;
  leakageFree:boolean;
  calibrationImproved:boolean;
  sampleSize:number;
  verdict:ExperimentVerdict;
  notes:string[];
}

export function judgeExperiment(
  experiment:Experiment,
  result:Omit<ExperimentResult,"experimentId"|"verdict">,
):ExperimentResult{
  const notes:string[]=[];
  if(!result.modelVersion)notes.push("model version is not recorded");
  if(!result.datasetVersion)notes.push("dataset version is not recorded");
  if(!result.leakageFree)notes.push("rejected because temporal/spatial leakage was detected");
  if(result.sampleSize<50)notes.push("sample size is too small for a strong conclusion");
  if(result.delta<=0)notes.push("treatment did not beat the baseline out-of-sample");
  if(!result.calibrationImproved)notes.push("predictive improvement did not improve calibration");

  let verdict:ExperimentVerdict;
  if(!result.leakageFree)verdict="REJECTED";
  else if(result.sampleSize<50||result.delta<=0)verdict="INSUFFICIENT_EVIDENCE";
  else if(result.delta>.10&&result.calibrationImproved)verdict="SUPPORTED";
  else verdict="PROMISING";

  return {...result,experimentId:experiment.id,verdict,notes};
}
