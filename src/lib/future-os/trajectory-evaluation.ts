export type BottleneckEvaluationSample = {
  scenarioId: string;
  bottleneckEdgeId: string;
  bottleneckConfirmed: boolean;
  realizedAccuracy: number;
  randomLinkAccuracy: number;
};

export type H2Evaluation = {
  confirmedMeanAccuracy: number;
  unconfirmedMeanAccuracy: number;
  bottleneckAccuracyLift: number;
  randomLinkMeanAccuracy: number;
  bottleneckVsRandomLift: number;
  confirmedCount: number;
  unconfirmedCount: number;
  sampleCount: number;
};

function mean(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function assertAccuracy(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${name} must be a finite value in [0, 1].`);
}

export function evaluateBottleneckH2(samples: BottleneckEvaluationSample[]): H2Evaluation {
  samples.forEach((sample) => {
    assertAccuracy(sample.realizedAccuracy, "realizedAccuracy");
    assertAccuracy(sample.randomLinkAccuracy, "randomLinkAccuracy");
  });
  const confirmed = samples.filter((s) => s.bottleneckConfirmed).map((s) => s.realizedAccuracy);
  const unconfirmed = samples.filter((s) => !s.bottleneckConfirmed).map((s) => s.realizedAccuracy);
  const random = samples.map((s) => s.randomLinkAccuracy);
  const confirmedMeanAccuracy = mean(confirmed);
  const unconfirmedMeanAccuracy = mean(unconfirmed);
  const randomLinkMeanAccuracy = mean(random);
  return {
    confirmedMeanAccuracy,
    unconfirmedMeanAccuracy,
    bottleneckAccuracyLift: confirmed.length && unconfirmed.length ? confirmedMeanAccuracy - unconfirmedMeanAccuracy : 0,
    randomLinkMeanAccuracy,
    bottleneckVsRandomLift: confirmed.length ? confirmedMeanAccuracy - randomLinkMeanAccuracy : 0,
    confirmedCount: confirmed.length,
    unconfirmedCount: unconfirmed.length,
    sampleCount: samples.length,
  };
}
