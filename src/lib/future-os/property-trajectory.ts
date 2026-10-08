export type PropertyTrajectoryPoint = {
  month: number;
  propertyValue: number;
  monthlyRent: number;
  cumulativeCashflow: number;
  equity: number;
  liquidityScore: number;
};

export function projectPropertyTrajectory(input: {
  purchasePrice: number;
  initialRent: number;
  monthlyCosts: number;
  loanAmount: number;
  months: number;
  monthlyPriceGrowth: number;
  monthlyRentGrowth: number;
  monthlyLiquidityChange: number;
}) {
  const points: PropertyTrajectoryPoint[] = [];
  let value = input.purchasePrice;
  let rent = input.initialRent;
  let cumulativeCashflow = 0;
  let liquidity = 1;
  for (let month = 1; month <= input.months; month++) {
    value *= 1 + input.monthlyPriceGrowth;
    rent *= 1 + input.monthlyRentGrowth;
    liquidity = Math.max(0, Math.min(1, liquidity + input.monthlyLiquidityChange));
    cumulativeCashflow += rent - input.monthlyCosts;
    points.push({
      month,
      propertyValue: value,
      monthlyRent: rent,
      cumulativeCashflow,
      equity: value - input.loanAmount,
      liquidityScore: liquidity,
    });
  }
  return points;
}
