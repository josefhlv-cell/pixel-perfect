export type ForecastQuantile = {
  quantile: number;
  value: number;
};

export type PredictiveDistribution = {
  quantiles: readonly ForecastQuantile[];
  support?: readonly number[];
  probabilities?: readonly number[];
};

export type ForecastDatasetRow = {
  region: string;
  date: string;
  target: number;
  features: Readonly<Record<string, number>>;
};

export type BaselineFitContext = {
  horizonMonths: number;
  seed: number;
};

export interface ForecastBaseline {
  readonly id: string;
  fit(
    rows: readonly ForecastDatasetRow[],
    context: BaselineFitContext,
  ): PredictiveDistribution;
}