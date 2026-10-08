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
  | "MORTGAGE_TO_PURCHASING_POWER"
  | "PURCHASING_POWER_TO_DEMAND"
  | "DEMAND_TO_LIQUIDITY"
  | "LIQUIDITY_TO_TRANSACTIONS"
  | "TRANSACTIONS_TO_PRICE_PRESSURE"
  | "PRICE_PRESSURE_TO_PRICES";

export type PreregisteredTrajectoryGraph = {
  version: "housing-chain-v0.1";
  nodeIds: readonly TrajectoryGraphNodeId[];
  edgeIds: readonly TrajectoryGraphEdgeId[];
  primaryH2EdgeIds: readonly TrajectoryGraphEdgeId[];
  secondaryEdgeIds: readonly TrajectoryGraphEdgeId[];
  pathSurvivalAggregation: "GEOMETRIC_MEAN";
  bottleneckRule: "MIN_EDGE_ROBUSTNESS";
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
    "MORTGAGE_TO_PURCHASING_POWER",
    "PURCHASING_POWER_TO_DEMAND",
    "DEMAND_TO_LIQUIDITY",
    "LIQUIDITY_TO_TRANSACTIONS",
    "TRANSACTIONS_TO_PRICE_PRESSURE",
    "PRICE_PRESSURE_TO_PRICES",
  ],
  primaryH2EdgeIds: [
    "MONETARY_TO_MORTGAGE",
    "MORTGAGE_TO_PURCHASING_POWER",
    "PURCHASING_POWER_TO_DEMAND",
  ],
  secondaryEdgeIds: [
    "DEMAND_TO_LIQUIDITY",
    "LIQUIDITY_TO_TRANSACTIONS",
    "TRANSACTIONS_TO_PRICE_PRESSURE",
    "PRICE_PRESSURE_TO_PRICES",
  ],
  pathSurvivalAggregation: "GEOMETRIC_MEAN",
  bottleneckRule: "MIN_EDGE_ROBUSTNESS",
}

export function isPreregisteredTrajectoryNode(
  id: string,
): id is TrajectoryGraphNodeId {
  return PREREGISTERED_TRAJECTORY_GRAPH.nodeIds.includes(
    id as TrajectoryGraphNodeId,
  );
}

export function isPreregisteredTrajectoryEdge(
  id: string,
): id is TrajectoryGraphEdgeId {
  return PREREGISTERED_TRAJECTORY_GRAPH.edgeIds.includes(
    id as TrajectoryGraphEdgeId,
  );
}
