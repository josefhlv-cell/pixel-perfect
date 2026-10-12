/**
 * Scheduled Future OS ingestion.
 *
 * This endpoint is deliberately separate from the listing watchdog. A successful
 * HTTP response means the scheduler ran; inspect each source result independently.
 * Retrieval time is a conservative availability cutoff, not a claimed publisher
 * release timestamp. Quarterly sources remain quarterly even when polled daily.
 */
import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { runSourceSync } from "@/lib/future-os/source-sync";
import { ingestEvidence } from "@/lib/future-os/ingest.server";
import { fetchEurostatHousePriceIndex } from "@/lib/future-os/adapters/eurostat.server";
import { fetchBisResidentialPropertyPrices } from "@/lib/future-os/adapters/bis.server";
import { importAradSet, DEFAULT_SET_IDS } from "@/lib/future-os/adapters/cnb-arad.server";

export const Route = createFileRoute("/api/public/cron/future-os-ingestion")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;

        const startedAt = new Date().toISOString();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8 * 60 * 1000);

        try {
          const sourceResults = await Promise.all([
            runSourceSync(
              "eurostat-prc-hpi-q",
              (signal) => fetchEurostatHousePriceIndex(["CZ"], signal),
              ingestEvidence,
              controller.signal,
            ),
            runSourceSync(
              "bis-rpp",
              (signal) => fetchBisResidentialPropertyPrices(["CZE"], signal),
              ingestEvidence,
              controller.signal,
            ),
          ]);

          const cnbResults: Array<{
            adapterKey: string;
            setId: string;
            startedAt: string;
            finishedAt: string;
            fetched: number;
            inserted: number;
            revised: number;
            skipped: number;
            error?: string;
          }> = [];

          // ARAD ingestion writes append-only evidence itself; isolate each set so
          // one invalid/unavailable set does not suppress the others.
          for (const setId of DEFAULT_SET_IDS.split(",")
            .map((s) => s.trim())
            .filter(Boolean)) {
            const setStartedAt = new Date().toISOString();
            try {
              const result = await importAradSet(setId);
              cnbResults.push({
                adapterKey: "cnb-arad",
                setId,
                startedAt: setStartedAt,
                finishedAt: new Date().toISOString(),
                fetched: result.fetched,
                inserted: result.inserted,
                revised: result.revised,
                skipped: result.skipped,
              });
            } catch (error) {
              cnbResults.push({
                adapterKey: "cnb-arad",
                setId,
                startedAt: setStartedAt,
                finishedAt: new Date().toISOString(),
                fetched: 0,
                inserted: 0,
                revised: 0,
                skipped: 0,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }

          const results = [
            ...sourceResults,
            ...cnbResults.map((r) => ({
              ...r,
              unchanged: r.skipped,
            })),
          ];
          const failed = results.filter((r) => "error" in r && Boolean(r.error)).length;
          const finishedAt = new Date().toISOString();
          let coverageHistoryError: string | undefined;
          try {
            const adapterKeys = [...new Set(results.map((r) => r.adapterKey))];
            const { data: adapters, error: adapterLookupError } = await supabaseAdmin
              .from("reality_source_adapters")
              .select("id,adapter_key")
              .in("adapter_key", adapterKeys);
            if (adapterLookupError) throw adapterLookupError;

            const adapterIds = new Map((adapters ?? []).map((a) => [a.adapter_key, a.id]));
            const coverageRows = results.flatMap((r) => {
              const adapterId = adapterIds.get(r.adapterKey);
              if (!adapterId) return [];
              const failedResult = "error" in r && Boolean(r.error);
              return [
                {
                  adapter_id: adapterId,
                  geography_type: "country",
                  geography_key: "CZ",
                  domain: "scheduled_ingestion" + ("setId" in r ? ":" + r.setId : ""),
                  period_start: null,
                  period_end: null,
                  availability_status: failedResult
                    ? "MISSING"
                    : r.fetched > 0
                      ? "AVAILABLE"
                      : "PARTIAL",
                  provenance_quality: null,
                  last_checked_at: r.finishedAt,
                  details: {
                    runStartedAt: r.startedAt,
                    runFinishedAt: r.finishedAt,
                    fetched: r.fetched,
                    inserted: r.inserted,
                    unchanged: r.unchanged,
                    revised: r.revised,
                    error: failedResult ? r.error : null,
                    runStartedBy: "pg_cron_or_authenticated_operator",
                  },
                },
              ];
            });
            if (coverageRows.length) {
              const { error: coverageError } = await supabaseAdmin
                .from("reality_data_coverage")
                .insert(coverageRows as never);
              if (coverageError) throw coverageError;
            }
          } catch (error) {
            coverageHistoryError = error instanceof Error ? error.message : String(error);
            console.error(
              "[future-os-ingestion] coverage history write failed",
              coverageHistoryError,
            );
          }

          const summary = {
            startedAt,
            finishedAt,
            sourcesAttempted: results.length,
            sourcesFailed: failed,
            coverageHistoryError: coverageHistoryError ?? null,
            results,
            semantics: {
              availableAt:
                "conservative retrieval cutoff unless publisher release time is independently verified",
              polling: "scheduler frequency does not change the source observation frequency",
              persistence:
                "append-only evidence; inspect per-source result before treating a run as successful",
            },
          };
          console.info("[future-os-ingestion]", JSON.stringify(summary));
          return Response.json(summary, { status: failed === results.length ? 502 : 200 });
        } finally {
          clearTimeout(timeout);
        }
      },
    },
  },
});
