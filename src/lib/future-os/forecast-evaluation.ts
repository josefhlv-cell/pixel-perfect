export type ForecastEvaluationSample = {
  actual: number;
  baselineActual: number;
  candidate: { p50: number; probabilityPositive: number };
  benchmark: { p50: number; probabilityPositive: number };
};

export type PairedMetric = "MAE" | "BRIER" | "LOG_LOSS" | "DIRECTIONAL_ERROR";

function metric(s: ForecastEvaluationSample, side: "candidate" | "benchmark", kind: PairedMetric) {
  const f = s[side];
  const actualChange = s.actual - s.baselineActual;
  const predictedChange = f.p50 - s.baselineActual;
  if (kind === "MAE") return Math.abs(predictedChange - actualChange);
  const p = Math.min(1 - 1e-12, Math.max(1e-12, f.probabilityPositive));
  const y = actualChange > 0 ? 1 : 0;
  if (kind === "BRIER") return (p - y) ** 2;
  if (kind === "LOG_LOSS") return -(y * Math.log(p) + (1 - y) * Math.log(1 - p));
  return Math.sign(predictedChange) === Math.sign(actualChange) ? 0 : 1;
}

/** Paired block bootstrap; preserves short-range serial dependence. */
export function compareForecastToBenchmark(
  samples: ForecastEvaluationSample[],
  kind: PairedMetric,
  blockLength = 4,
  iterations = 1000,
) {
  if (samples.length < 20) return null;
  const deltas = samples.map(s => metric(s, "candidate", kind) - metric(s, "benchmark", kind));
  const mean = deltas.reduce((a,b)=>a+b,0) / deltas.length;
  let state = 0x9e3779b9;
  const random = () => {
    state ^= state << 13; state >>>= 0; state ^= state >>> 17; state >>>= 0; state ^= state << 5; state >>>= 0;
    return state / 0x100000000;
  };
  const means:number[]=[];
  const block=Math.max(1,Math.min(blockLength,deltas.length));
  for(let k=0;k<iterations;k++){
    let sum=0,count=0;
    while(count<deltas.length){
      const start=Math.floor(random()*deltas.length);
      const take=Math.min(block,deltas.length-count);
      for(let j=0;j<take;j++) sum+=deltas[(start+j)%deltas.length]!;
      count+=take;
    }
    means.push(sum/deltas.length);
  }
  means.sort((a,b)=>a-b);
  const q=(p:number)=>means[Math.floor((means.length-1)*p)];
  const low=q(.025), high=q(.975);
  return {
    metric:kind,
    candidateMean:samples.reduce((a,s)=>a+metric(s,"candidate",kind),0)/samples.length,
    benchmarkMean:samples.reduce((a,s)=>a+metric(s,"benchmark",kind),0)/samples.length,
    improvement:-mean,
    confidenceLow:-high!,
    confidenceHigh:-low!,
    significant:high!<0,
    bootstrapSamples:iterations,
  };
}
