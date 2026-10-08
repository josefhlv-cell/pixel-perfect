import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { WorldStateSnapshot } from "./types";
import { assertNoFutureEvidence } from "./point-in-time";
import { getEvidenceAvailableAt } from "./evidence.server";

type Client = SupabaseClient<Database>;

export async function getWorldStateAt(
  supabase: Client,
  geographyType: string,
  geographyKey: string,
  asOf: Date | string,
) {
  const cutoff = new Date(asOf).toISOString();
  const { data: snapshot, error } = await supabase
    .from("reality_world_state_snapshots")
    .select("*")
    .eq("geography_type", geographyType)
    .eq("geography_key", geographyKey)
    .lte("as_of", cutoff)
    .order("as_of", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!snapshot) return null;

  const evidence = await getEvidenceAvailableAt(supabase, asOf, { geographyType, geographyKey });
  const evidenceIds = Array.isArray(snapshot.evidence_ids)
    ? snapshot.evidence_ids.filter((id): id is string => typeof id === "string")
    : [];
  if (evidenceIds.length) {
    const allowed = new Set(evidence.rows.map((row) => row.id));
    const futureIds = evidenceIds.filter((id) => !allowed.has(id));
    if (futureIds.length) throw new Error(`World-state snapshot contains evidence unavailable at ${cutoff}: ${futureIds.join(",")}`);
  }
  assertNoFutureEvidence(evidence.rows, asOf);

  const result: WorldStateSnapshot = {
    id: snapshot.id,
    geographyType: snapshot.geography_type,
    geographyKey: snapshot.geography_key,
    asOf: snapshot.as_of,
    state: (snapshot.state ?? {}) as Record<string, unknown>,
    evidenceIds,
    evidenceCount: snapshot.evidence_count,
    missingness: (snapshot.missingness ?? {}) as Record<string, unknown>,
    confidence: snapshot.confidence == null ? null : Number(snapshot.confidence),
    regime: snapshot.regime,
    createdAt: snapshot.created_at,
  };
  return { snapshot: result, evidence };
}
