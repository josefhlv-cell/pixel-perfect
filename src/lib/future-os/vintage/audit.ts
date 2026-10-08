export type VintageAuditTier = "OBSERVED" | "ASSUMED";
export type LagBasis = "OBSERVED_TIMESTAMP" | "ASSUMED_FIXED_LAG";
export type AuditStatus = "AUDITED" | "PENDING_SOURCE_VERIFICATION";

export type VintageAuditNode = {
  nodeId: string;
  sourceId: string;
  seriesId: string;
  transformation: string;
  unit: string;
  publicationLagDays: number;
  lagBasis: LagBasis;
  dataTier: VintageAuditTier;
  coverageStart: string;
  coverageEnd: string;
  regionCoverage: readonly string[];
  revisionPolicy: "VINTAGE_AS_PUBLISHED" | "LATEST_REVISION";
  auditStatus: AuditStatus;
};

export const PRIMARY_H2_VINTAGE_AUDIT: readonly VintageAuditNode[] = [
  {
    nodeId: "MONETARY_CONDITIONS",
    sourceId: "CNB_ARAD",
    seriesId: "CNB_POLICY_RATE",
    transformation: "LEVEL",
    unit: "percent",
    publicationLagDays: 1,
    lagBasis: "ASSUMED_FIXED_LAG",
    dataTier: "ASSUMED",
    coverageStart: "PENDING",
    coverageEnd: "PENDING",
    regionCoverage: ["CZ"],
    revisionPolicy: "VINTAGE_AS_PUBLISHED",
    auditStatus: "PENDING_SOURCE_VERIFICATION",
  },
  {
    nodeId: "MORTGAGE_CREDIT",
    sourceId: "CNB_ARAD",
    seriesId: "HOUSE_PURCHASE_LOAN_RATE",
    transformation: "LEVEL",
    unit: "percent",
    publicationLagDays: 45,
    lagBasis: "ASSUMED_FIXED_LAG",
    dataTier: "ASSUMED",
    coverageStart: "PENDING",
    coverageEnd: "PENDING",
    regionCoverage: ["CZ"],
    revisionPolicy: "VINTAGE_AS_PUBLISHED",
    auditStatus: "PENDING_SOURCE_VERIFICATION",
  },
  {
    nodeId: "BUYER_DEMAND",
    sourceId: "CNB_BLS",
    seriesId: "HOUSEHOLD_HOUSING_LOAN_DEMAND",
    transformation: "INDEX",
    unit: "net_percentage",
    publicationLagDays: 60,
    lagBasis: "ASSUMED_FIXED_LAG",
    dataTier: "ASSUMED",
    coverageStart: "PENDING",
    coverageEnd: "PENDING",
    regionCoverage: ["CZ"],
    revisionPolicy: "VINTAGE_AS_PUBLISHED",
    auditStatus: "PENDING_SOURCE_VERIFICATION",
  },
  {
    nodeId: "TRANSACTIONS",
    sourceId: "CZSO",
    seriesId: "HOUSING_TRANSACTIONS",
    transformation: "YOY_CHANGE",
    unit: "percent",
    publicationLagDays: 60,
    lagBasis: "ASSUMED_FIXED_LAG",
    dataTier: "ASSUMED",
    coverageStart: "PENDING",
    coverageEnd: "PENDING",
    regionCoverage: ["CZ"],
    revisionPolicy: "VINTAGE_AS_PUBLISHED",
    auditStatus: "PENDING_SOURCE_VERIFICATION",
  },
] as const;

export function validateVintageAudit(
  nodes: readonly VintageAuditNode[],
  strict = true,
): void {
  const ids = new Set<string>();
  for (const node of nodes) {
    if (ids.has(node.nodeId)) throw new Error(`Duplicate vintage audit node: ${node.nodeId}`);
    ids.add(node.nodeId);
    if (!node.sourceId || !node.seriesId || !node.transformation || !node.unit) {
      throw new Error(`Incomplete vintage audit metadata: ${node.nodeId}`);
    }
    if (!Number.isInteger(node.publicationLagDays) || node.publicationLagDays < 0) {
      throw new Error(`Invalid publication lag: ${node.nodeId}`);
    }
    if (node.lagBasis === "OBSERVED_TIMESTAMP" && node.dataTier !== "OBSERVED") {
      throw new Error(`Observed timestamp requires OBSERVED tier: ${node.nodeId}`);
    }
    if (node.lagBasis === "ASSUMED_FIXED_LAG" && node.dataTier !== "ASSUMED") {
      throw new Error(`Assumed lag requires ASSUMED tier: ${node.nodeId}`);
    }
    if (strict && (node.dataTier === "ASSUMED" || node.auditStatus !== "AUDITED")) {
      throw new Error(`Strict vintage audit is not complete: ${node.nodeId}`);
    }
  }
}
