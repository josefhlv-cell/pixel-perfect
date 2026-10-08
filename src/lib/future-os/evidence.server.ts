import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { EvidenceFilters, EvidenceObservation } from "./types";
import { assertNoFutureEvidence, computeDataQuality } from "./point-in-time";

type Client = SupabaseClient<Database>;

function mapRow(row: Database["public"]["Tables"]["reality_evidence"]["Row"]): EvidenceObservation {
  return {
    id: row.id,
    sourceId: row.source_id,
    sourceName: row.source_name,
    sourceType: row.source_type,
    sourceUrl: row.source_url,
    publisher: row.publisher,
    geographyType: row.geography_type,
    geographyKey: row.geography_key,
    entityType: row.entity_type,
    entityKey: row.entity_key,
    observedAt: row.observed_at,
    publishedAt: row.published_at,
    retrievedAt: row.retrieved_at,
    availableAt: row.available_at,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    revision: row.revision,
    value: row.value,
    unit: row.unit,
    frequency: row.frequency,
    leadClass: row.lead_class,
    sourceReliability: Number(row.source_reliability),
    independenceGroup: row.independence_group,
    contentHash: row.content_hash,
    isRevision: row.is_revision,
    supersedesId: row.supersedes_id,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

export async function getEvidenceAvailableAt(
  supabase: Client,
  asOf: Date | string,
  filters: EvidenceFilters = {},
) {
  const { data, error } = await supabase.rpc("get_reality_evidence_available_at", {
    p_as_of: new Date(asOf).toISOString(),
    p_geography_type: filters.geographyType ?? null,
    p_geography_key: filters.geographyKey ?? null,
  });
  if (error) throw error;

  const rows = (data ?? []).map(mapRow).filter((row) =>
    (!filters.sourceId || row.sourceId === filters.sourceId) &&
    (!filters.entityType || row.entityType === filters.entityType) &&
    (!filters.entityKey || row.entityKey === filters.entityKey) &&
    (!filters.leadClass || row.leadClass === filters.leadClass),
  );
  assertNoFutureEvidence(rows, asOf);
  return { rows, dataQuality: computeDataQuality(rows) };
}
