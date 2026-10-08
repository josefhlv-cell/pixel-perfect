export type TrajectoryGraphNodeId =
  | "MONETARY_CONDITIONS"
  | "MORTGAGE_CREDIT"
  | "PURCHASING_POWER"
  | "BUYER_DEMAND"
  | "MARKET_LIQUIDITY"
  | "TRANSACTIONS"
  | "PRICE_PRESSURE"
  | "HOUSE_PRICES";

export type TrajectoryGraphEdgeId =
  | "MONETARY_TO_MORTGAGE"
  | "MORTGAGE_TO_BUYER_DEMAND"
  | "MORTGAGE_TO_PURCHASING_POWER"
  | "PURCHASING_POWER_TO_DEMAND"
  | "DEMAND_TO_LIQUIDITY"
  | "LIQUIDITY_TO_TRANSACTIONS"
  | "BUYER_DEMAND_TO_TRANSACTIONS"
  | "TRANSACTIONS_TO_PRICE_PRESSURE"
  | "PRICE_PRESSURE_TO_PRICES";

export type TrajectoryAggregation = "GEOMETRIC_MEAN";

export type TrajectoryBottleneckRule = {
  edgeRobustness: "SURVIVAL_X_EVIDENCE_ASSOCIATION";
  tieBreak: "LEXICOGRAPHIC_EDGE_ID";
  minimumSeparation: 0.05;
};

export type PreregisteredTrajectorySpecification = {
  version: string;
  nodeIds: readonly TrajectoryGraphNodeId[];
  edgeIds: readonly TrajectoryGraphEdgeId[];
  pathSurvivalAggregation: TrajectoryAggregation;
  primaryH2EdgeIds: readonly [
    "MONETARY_TO_MORTGAGE",
    "MORTGAGE_TO_BUYER_DEMAND",
    "BUYER_DEMAND_TO_TRANSACTIONS",
  ];
  bottleneckRule: TrajectoryBottleneckRule;
};

export type PreregisteredTrajectoryGraph = PreregisteredTrajectorySpecification & {
  version: "housing-chain-v0.1";
};

export const PREREGISTERED_TRAJECTORY_GRAPH: PreregisteredTrajectoryGraph = {
  version: "housing-chain-v0.1",
  nodeIds: [
    "MONETARY_CONDITIONS",
    "MORTGAGE_CREDIT",
    "PURCHASING_POWER",
    "BUYER_DEMAND",
    "MARKET_LIQUIDITY",
    "TRANSACTIONS",
    "PRICE_PRESSURE",
    "HOUSE_PRICES",
  ],
  edgeIds: [
    "MONETARY_TO_MORTGAGE",
    "MORTGAGE_TO_BUYER_DEMAND",
    "MORTGAGE_TO_PURCHASING_POWER",
    "PURCHASING_POWER_TO_DEMAND",
    "DEMAND_TO_LIQUIDITY",
    "LIQUIDITY_TO_TRANSACTIONS",
    "BUYER_DEMAND_TO_TRANSACTIONS",
    "TRANSACTIONS_TO_PRICE_PRESSURE",
    "PRICE_PRESSURE_TO_PRICES",
  ],
  pathSurvivalAggregation: "GEOMETRIC_MEAN",
  primaryH2EdgeIds: [
    "MONETARY_TO_MORTGAGE",
    "MORTGAGE_TO_BUYER_DEMAND",
    "BUYER_DEMAND_TO_TRANSACTIONS",
  ],
  bottleneckRule: {
    edgeRobustness: "SURVIVAL_X_EVIDENCE_ASSOCIATION",
    tieBreak: "LEXICOGRAPHIC_EDGE_ID",
    minimumSeparation: 0.05,
  },
} as const;

export const SECONDARY_TRAJECTORY_EDGE_IDS: readonly TrajectoryGraphEdgeId[] = [
  "MONETARY_TO_MORTGAGE",
  "MORTGAGE_TO_PURCHASING_POWER",
  "PURCHASING_POWER_TO_DEMAND",
  "DEMAND_TO_LIQUIDITY",
  "LIQUIDITY_TO_TRANSACTIONS",
  "BUYER_DEMAND_TO_TRANSACTIONS",
  "TRANSACTIONS_TO_PRICE_PRESSURE",
  "PRICE_PRESSURE_TO_PRICES",
];

export function isPreregisteredTrajectoryNode(
  value: string,
): value is TrajectoryGraphNodeId {
  return PREREGISTERED_TRAJECTORY_GRAPH.nodeIds.includes(
    value as TrajectoryGraphNodeId,
  );
}

export function isPreregisteredTrajectoryEdge(
  value: string,
): value is TrajectoryGraphEdgeId {
  return PREREGISTERED_TRAJECTORY_GRAPH.edgeIds.includes(
    value as TrajectoryGraphEdgeId,
  );
}
