export type LeadClass = "LEADING" | "COINCIDENT" | "LAGGING" | "UNKNOWN";

export interface EvidenceObservation {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceType: string;
  sourceUrl: string | null;
  publisher: string | null;
  geographyType: string;
  geographyKey: string;
  entityType: string;
  entityKey: string;
  observedAt: string | null;
  publishedAt: string | null;
  retrievedAt: string;
  availableAt: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  revision: number;
  value: unknown;
  unit: string | null;
  frequency: string | null;
  leadClass: LeadClass;
  sourceReliability: number;
  independenceGroup: string;
  contentHash: string;
  isRevision: boolean;
  supersedesId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface EvidenceFilters {
  sourceId?: string;
  geographyType?: string;
  geographyKey?: string;
  entityType?: string;
  entityKey?: string;
  leadClass?: LeadClass;
}

export interface DataQuality {
  completeness: number;
  provenanceCompleteness: number;
  sourceReliability: number;
  independence: number;
  status: "READY" | "LIMITED" | "DATA_STARVED";
  missingFields: string[];
}

export interface WorldStateSnapshot {
  id: string;
  geographyType: string;
  geographyKey: string;
  asOf: string;
  state: Record<string, unknown>;
  evidenceIds: string[];
  evidenceCount: number;
  missingness: Record<string, unknown>;
  confidence: number | null;
  regime: string | null;
  createdAt: string;
}

export interface FutureRadarFoundation {
  currentState: Record<string, unknown>;
  leadingSignals: EvidenceObservation[];
  dataQuality: DataQuality;
  modelReady: boolean;
  status: "CLEAR" | "CONTESTED" | "DATA_STARVED";
  nextBestObservation: {
    required: boolean;
    reason: string;
  };
}
