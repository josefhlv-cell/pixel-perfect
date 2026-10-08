export const PRIMARY_H2_GRAPH_VERSION = "housing-primary-h2-v0.1" as const;

export const PRIMARY_H2_NODE_SPECS = [
  {
    id: "MONETARY_CONDITIONS",
    label: "Monetary conditions",
    sourceId: "CNB_ARAD",
    seriesId: "CNB_POLICY_RATE",
    transform: "LEVEL",
    publicationLagDays: 1,
    dataTier: "OBSERVED",
    thresholdLow: -1,
    thresholdHigh: 1,
    unit: "percentage_points_vs_training_baseline",
  },
  {
    id: "MORTGAGE_CREDIT",
    label: "Mortgage rate / housing credit conditions",
    sourceId: "CNB_ARAD",
    seriesId: "HOUSE_PURCHASE_LOAN_RATE",
    transform: "LEVEL",
    publicationLagDays: 45,
    dataTier: "OBSERVED",
    thresholdLow: -1,
    thresholdHigh: 1,
    unit: "percentage_points_vs_training_baseline",
  },
  {
    id: "BUYER_DEMAND",
    label: "Demand for housing loans",
    sourceId: "CNB_BLS",
    seriesId: "HOUSEHOLD_HOUSING_LOAN_DEMAND",
    transform: "INDEX",
    publicationLagDays: 60,
    dataTier: "OBSERVED",
    thresholdLow: -1,
    thresholdHigh: 1,
    unit: "standardized_training_index",
  },
  {
    id: "TRANSACTIONS",
    label: "Housing transaction activity",
    sourceId: "CZSO",
    seriesId: "HOUSING_TRANSACTIONS",
    transform: "YOY_CHANGE",
    publicationLagDays: 60,
    dataTier: "OBSERVED",
    thresholdLow: -1,
    thresholdHigh: 1,
    unit: "standardized_training_change",
  },
] as const;

export const PRIMARY_H2_EDGE_SPECS = [
  {
    id: "MONETARY_TO_MORTGAGE",
    from: "MONETARY_CONDITIONS",
    to: "MORTGAGE_CREDIT",
    direction: -1,
    lagMonthsMin: 1,
    lagMonthsMax: 6,
    primaryForH2: true,
    literatureSupport: "SUPPORTED",
  },
  {
    id: "MORTGAGE_TO_BUYER_DEMAND",
    from: "MORTGAGE_CREDIT",
    to: "BUYER_DEMAND",
    direction: -1,
    lagMonthsMin: 1,
    lagMonthsMax: 6,
    primaryForH2: true,
    literatureSupport: "SUPPORTED",
  },
  {
    id: "BUYER_DEMAND_TO_TRANSACTIONS",
    from: "BUYER_DEMAND",
    to: "TRANSACTIONS",
    direction: 1,
    lagMonthsMin: 1,
    lagMonthsMax: 6,
    primaryForH2: true,
    literatureSupport: "HYPOTHESIS",
  },
] as const;

export const PRIMARY_H2_SPEC = {
  version: PRIMARY_H2_GRAPH_VERSION,
  nodes: PRIMARY_H2_NODE_SPECS,
  edges: PRIMARY_H2_EDGE_SPECS,
  primaryH2EdgeIds: PRIMARY_H2_EDGE_SPECS.map((edge) => edge.id),
  bottleneckRule: {
    aggregation: "GEOMETRIC_MEAN",
    edgeRobustness: "SURVIVAL_X_EVIDENCE_ASSOCIATION",
    tieBreak: "LEXICOGRAPHIC_EDGE_ID",
    minimumSeparation: 0.05,
  },
} as const;

export function assertPrimaryGraphMatchesPreregistration(): void {
  if (PRIMARY_H2_SPEC.primaryH2EdgeIds.length !== 3) {
    throw new Error("Primary H2 must contain exactly three edges.");
  }
  const expected = PRIMARY_H2_EDGE_SPECS.map((edge) => edge.id);
  if (JSON.stringify(expected) !== JSON.stringify(PRIMARY_H2_SPEC.primaryH2EdgeIds)) {
    throw new Error("Primary H2 graph differs from its canonical edge specification.");
  }
}
