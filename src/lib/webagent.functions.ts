/**
 * AI Web Agent for Deal Hunter: SEARCH → OPEN → EXTRACT → NORMALIZE → SAVE (LIVE)
 * → FRESHNESS (existing engine). Valuation/calculation/Deal Priority run in the
 * existing enrichment on read. Never creates fake live data.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const runWebAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ query: z.string().trim().min(3).max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    const { runAgentPipeline } = await import("./webagent-core.server");
    const result = await runAgentPipeline(context.supabase, context.userId, data.query);
    if (result.ok && result.listingIds.length > 0) {
      try {
        const { refreshLiveMarketStats } = await import("./market-refresh.server");
        await refreshLiveMarketStats();
      } catch (e) { console.error("[webagent] market refresh", e); }
    }
    return result;
  });
