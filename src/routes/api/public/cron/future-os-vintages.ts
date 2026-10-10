/**
 * Archive each fetched Eurostat HPI retrieval as an immutable point-in-time snapshot.
 * A retrieval snapshot is not a publisher-provided historical vintage.
 */
import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { fetchEurostatHousePriceIndex } from "@/lib/future-os/adapters/eurostat.server";
import { toSourceVintageInserts } from "@/lib/future-os/source-vintages";
import { CZECH_HPI_SERIES } from "@/lib/future-os/predictive-core/publish";

export const Route = createFileRoute("/api/public/cron/future-os-vintages")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        try {
          const observations = await fetchEurostatHousePriceIndex(["CZ"], request.signal);
          const snapshots = toSourceVintageInserts(observations);
          if (!snapshots.length) {
            return Response.json({ ok: false, error: "Eurostat returned no valid Czech HPI observations." }, { status: 502 });
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
