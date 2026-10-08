export type TrajectoryAggregation = "GEOMETRIC_MEAN";

export type PreregisteredTrajectoryNode = {
  id:
    | "RATES"
    | "MORTGAGE_CREDIT"
    | "PURCHASING_POWER"
    | "DEMAND"
    | "INVENTORY"
    | "TRANSACTIONS"
    | "PRICE";
  label: string;
};

export type PreregisteredTrajectoryEdge = {
  id:
    | "RATES_TO_MORTGAGE_CREDIT"
    | "MORTGAGE_CREDIT_TO_PURCHASING_POWER"
    | "PURCHASING_POWER_TO_DEMAND"
    | "DEMAND_TO_TRANSACTIONS"
    | "INVENTORY_TO_TRANSACTIONS"
    | "TRANSACTIONS_TO_PRICE";
  from: PreregisteredTrajectoryNode["id"];
  to: PreregisteredTrajectoryNode["id"];
};

/**
 * Frozen for Experiment v0.1.
 * This topology is part of preregistration: changing nodes or edges creates
 * a new experiment version and invalidates H2 comparability.
 */
export const PREREGISTERED_TRAJECTORY_GRAPH = {
  version: "0.1",
  aggregation: "GEOMETRIC_MEAN" as const satisfies TrajectoryAggregation,
  nodes: [
    { id: "RATES", label: "Rates" },
    { id: "MORTGAGE_CREDIT", label: "Mortgage / credit" },
    { id: "PURCHASING_POWER", label: "Purchasing power" },
    { id: "DEMAND", label: "Demand" },
    { id: "INVENTORY", label: "Inventory" },
    { id: "TRANSACTIONS", label: "Transactions" },
    { id: "PRICE", label: "Price" },
  ] as const satisfies readonly PreregisteredTrajectoryNode[],
  edges: [
    {
      id: "RATES_TO_MORTGAGE_CREDIT",
      from: "RATES",
      to: "MORTGAGE_CREDIT",
    },
    {
      id: "MORTGAGE_CREDIT_TO_PURCHASING_POWER",
      from: "MORTGAGE_CREDIT",
      to: "PURCHASING_POWER",
    },
    {
      id: "PURCHASING_POWER_TO_DEMAND",
      from: "PURCHASING_POWER",
      to: "DEMAND",
    },
    {
      id: "DEMAND_TO_TRANSACTIONS",
      from: "DEMAND",
      to: "TRANSACTIONS",
    },
    {
      id: "INVENTORY_TO_TRANSACTIONS",
      from: "INVENTORY",
      to: "TRANSACTIONS",
    },
    {
      id: "TRANSACTIONS_TO_PRICE",
      from: "TRANSACTIONS",
      to: "PRICE",
    },
  ] as const satisfies readonly PreregisteredTrajectoryEdge[],
} as const;
