/**
 * Archive current Eurostat and BIS house-price observations as immutable retrieval snapshots.
 * A retrieval snapshot is not a publisher-provided historical vintage.
 */
import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { fetchEurostatHousePriceIndex } from "@/lib/future-os/adapters/eurostat.server";
import { fetchBisResidentialPropertyPrices } from "@/lib/future-os/adapters/bis.server";
import { fetchEcbCzechLongTermRates } from "@/lib/future-os/adapters/ecb.server";
import { toSourceVintageInserts } from "@/lib/future-os/source-vintages";

export const Route = createFileRoute("/api/public/cron/future-os-vintages")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        try {
          const results = await Promise.allSettled([
            fetchEurostatHousePriceIndex(["CZ"], request.signal),
            fetchBisResidentialPropertyPrices(["CZ"], request.signal),
            fetchEcbCzechLongTermRates(request.signal),
          ]);
          const sourceFailures = results.flatMap((result, index) => result.status === "rejected"
            ? [{ source: index === 0 ? "eurostat-prc-hpi-q" : index === 1 ? "bis-ws-spp" : "ecb-irs-cz-10y", error: result.reason instanceof Error ? result.reason.message : "Source fetch failed" }]
            : []);
          const observations = results.flatMap(result => result.status === "fulfilled" ? result.value : []);
          const snapshots = toSourceVintageInserts(observations);
          if (!snapshots.length) {
            return Response.json({
              ok: false,
              error: "No valid source observations were returned.",
              sourceFailures,
            }, { status: 502 });
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
            ok: sourceFailures.length === 0,
            sourceCount: new Set(snapshots.map(row => row.source_key)).size,
            sources: [...new Set(snapshots.map(row => row.source_key))],
            observationsFetched: observations.length,
            validSnapshots: snapshots.length,
            newlyInserted: data?.length ?? 0,
            retrievedAt: snapshots[0]?.retrieved_at ?? null,
            quality: "RETRIEVAL_SNAPSHOT",
            sourceFailures,
            pointInTimeCaveat: "Snapshots record what this application retrieved at each collection time; they are not archived source-published vintages and do not reconstruct historical values before collection began.",
          }, { status: sourceFailures.length ? 207 : 200 });
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
