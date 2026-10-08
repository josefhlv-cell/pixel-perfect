import { createHash } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { EvidenceObservation } from "./types";

function hashObservation(row: EvidenceObservation) {
  const canonical = JSON.stringify({
    sourceId: row.sourceId,
    geographyType: row.geographyType,
    geographyKey: row.geographyKey,
    entityType: row.entityType,
    entityKey: row.entityKey,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    value: row.value,
    unit: row.unit,
    frequency: row.frequency,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

export async function ingestEvidence(
  adapterKey: string,
  observations: EvidenceObservation[],
) {
  const { data: adapter, error: adapterError } = await supabaseAdmin
    .from("reality_source_adapters")
    .select("source_id,source_name,publisher,canonical_url,reliability,independence_group")
    .eq("adapter_key", adapterKey)
    .single();
  if (adapterError) throw adapterError;
  if (!adapter.source_id) throw new Error(`Adapter ${adapterKey} has no evidence source.`);

  let inserted = 0;
  let unchanged = 0;
  let revised = 0;

  for (const row of observations) {
    const contentHash = hashObservation(row);
    const effectiveKey = row.effectiveFrom ?? row.observedAt ?? row.createdAt;

    const { data: same, error: sameError } = await supabaseAdmin
      .from("reality_evidence")
      .select("id,revision")
      .eq("source_id", adapter.source_id)
      .eq("geography_type", row.geographyType)
      .eq("geography_key", row.geographyKey)
      .eq("entity_type", row.entityType)
      .eq("entity_key", row.entityKey)
      .eq("effective_from", effectiveKey)
      .eq("content_hash", contentHash)
      .limit(1)
      .maybeSingle();
    if (sameError) throw sameError;
    if (same) {
      unchanged++;
      continue;
    }

    const { data: latest, error: latestError } = await supabaseAdmin
      .from("reality_evidence")
      .select("id,revision")
      .eq("source_id", adapter.source_id)
      .eq("geography_type", row.geographyType)
      .eq("geography_key", row.geographyKey)
      .eq("entity_type", row.entityType)
      .eq("entity_key", row.entityKey)
      .eq("effective_from", effectiveKey)
      .order("revision", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) throw latestError;

    const revision = (latest?.revision ?? 0) + 1;
    const { error: insertError } = await supabaseAdmin
      .from("reality_evidence")
      .insert({
        source_id: adapter.source_id,
        source_url: row.sourceUrl ?? adapter.canonical_url,
        source_name: adapter.sourceName,
        source_type: row.sourceType,
        publisher: row.publisher ?? adapter.publisher,
        geography_type: row.geographyType,
        geography_key: row.geographyKey,
        entity_type: row.entityType,
        entity_key: row.entityKey,
        observed_at: row.observedAt,
        published_at: row.publishedAt,
        retrieved_at: row.retrievedAt,
        available_at: row.availableAt,
        effective_from: row.effectiveFrom,
        effective_to: row.effectiveTo,
        revision,
        value: row.value as never,
        unit: row.unit,
        frequency: row.frequency,
        lead_class: row.leadClass,
        source_reliability: row.sourceReliability ?? adapter.reliability ?? 0.5,
        independence_group: row.independenceGroup || adapter.independence_group,
        content_hash: contentHash,
        is_revision: revision > 1,
        supersedes_id: latest?.id ?? null,
        metadata: {
          ...row.metadata,
          adapterKey,
          ingestionMode: "server_append_only",
        },
      });
    if (insertError) throw insertError;

    inserted++;
    if (revision > 1) revised++;
  }

  return { inserted, unchanged, revised, total: observations.length };
}
