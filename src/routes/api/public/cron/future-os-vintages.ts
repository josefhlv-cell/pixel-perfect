/**
 * Archive each fetched Eurostat HPI retrieval as an immutable point-in-time snapshot.
 * Trigger from the existing authenticated scheduler. A retrieval snapshot is not
 * mislabeled as a publisher-provided historical vintage.
 */
import { createHash } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { fetchEurostatHousePriceIndex } from "@/lib/future-os/adapters/eurostat.server";
import { CZECH_HPI_SERIES } from "@/lib/future-os/predictive-core/publish";

type SnapshotInsert = {
  source_key: string;
  series_key: string;
  geography_key: string;
  period_key: string;
  source_published_at: string | null;
  retrieved_at: string;
  source_revision: string | null;
  numeric_value: number;
  unit: string;
  raw_payload: Record<string, unknown>;
  payload_hash: string;
  quality: "RETRIEVAL_SNAPSHOT";
};

export const Route = createFileRoute("/api/public/cron/future-os-vintages")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        try {
          const observations = await fetchEurostatHousePriceIndex(["CZ"], request.signal);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const snapshots: SnapshotInsert[] = [];

          for (const observation of observations) {
            const raw = observation.value;
            if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
            const value = raw as Record<string, unknown>;
            const period = typeof value.period === "string" ? value.period : null;
            const numericValue = typeof value.value === "number" ? value.value : null;
            if (!period || numericValue == null || !Number.isFinite(numericValue)) continue;

            const canonical = JSON.stringify({
              source: "eurostat-prc-hpi-q",
              series: CZECH_HPI_SERIES,
              geography: observation.geographyKey,
              period,
              value: numericValue,
              unit: observation.unit,
              sourceUpdated: observation.metadata.eurostatDatasetUpdatedAt ?? null,
            });
            snapshots.push({
              source_key: "eurostat-prc-hpi-q",
              series_key: CZECH_HPI_SERIES,
              geography_key: observation.geographyKey,
              period_key: period,
              source_published_at: observation.publishedAt,
              retrieved_at: observation.retrievedAt,
              source_revision: typeof observation.metadata.eurostatDatasetUpdatedAt === "string"
                ? observation.metadata.eurostatDatasetUpdatedAt
                : null,
              numeric_value: numericValue,
              unit: observation.unit ?? "index_2015_100",
              raw_payload: {
                value: numericValue,
                period,
                sourceUrl: observation.sourceUrl,
                observedAt: observation.observedAt,
                retrievedAt: observation.retrievedAt,
                availableAt: observation.availableAt,
                sourceRevision: observation.metadata.eurostatDatasetUpdatedAt ?? null,
                quality: "RETRIEVAL_SNAPSHOT",
              },
              payload_hash: createHash("sha256").update(canonical).digest("hex"),
              quality: "RETRIEVAL_SNAPSHOT",
            });
          }

          if (!snapshots.length) {
            return Response.json({ ok: false, error: "Eurostat returned no valid Czech HPI observations." }, { status: 502 });
          }

          const { data, error } = await supabaseAdmin
            .from("reality_source_vintages")
            .upsert(snapshots, {
              onConflict: "source_key,series_key,geography_key,period_key,retrieved_at,payload_hash",
              ignoreDuplicates: true,
            })
            .select("id");

          if (error) throw new Error(error.message);

          return Response.json({
            ok: true,
            source: "eurostat-prc-hpi-q",
            series: CZECH_HPI_SERIES,
            observationsFetched: observations.length,
            validSnapshots: snapshots.length,
            newlyInserted: data?.length ?? 0,
            retrievedAt: snapshots[0]?.retrieved_at ?? null,
            quality: "RETRIEVAL_SNAPSHOT",
            pointInTimeCaveat: "Snapshots record what this application retrieved at each collection time; they are not archived Eurostat publication vintages and do not reconstruct historical values before collection began.",
          });
        } catch (error) {
          console.error("[future-os-vintages]", error);
          return Response.json(
            { ok: false, error: error instanceof Error ? error.message : "Vintage ingestion failed." },
            { status: 500 },
          );
        }
      },
    },
  },
});
