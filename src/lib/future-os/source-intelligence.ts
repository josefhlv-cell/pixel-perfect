export type SourceAdapterProfile = {
  adapterKey: string;
  sourceName: string;
  latencyClass: "REALTIME" | "INTRADAY" | "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "ANNUAL" | "UNKNOWN";
  frequencies: string[];
  dataDomains: string[];
  geographyScopes: string[];
  publicationTimestampAvailable: boolean;
  pointInTimeSafe: boolean;
  reliability: number | null;
  independenceGroup: string;
  status: "PLANNED" | "ACTIVE" | "DEGRADED" | "BLOCKED" | "RETIRED";
};

export function sourceReadiness(profile: SourceAdapterProfile) {
  if (profile.status !== "ACTIVE") return "NOT_READY" as const;
  if (!profile.pointInTimeSafe) return "REQUIRES_PROVENANCE" as const;
  if (!profile.publicationTimestampAvailable) return "CONSERVATIVE_RETRIEVAL_CUTOFF" as const;
  return "READY" as const;
}
