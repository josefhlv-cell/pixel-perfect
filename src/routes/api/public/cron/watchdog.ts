/**
 * Scheduled watchdog (pg_cron → every 30 min). Re-runs every saved search whose last
 * run is older than 20 h — i.e. each watch runs once a day — for ALL users, and posts
 * an in-app alert when new listings arrive. Bounded to 2 watches per call.
 */
import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

const DUE_MS = 20 * 3600_000;

export const Route = createFileRoute("/api/public/cron/watchdog")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: watches } = await supabaseAdmin.from("searches").select("id,user_id,query,last_run_at")
          .eq("status", "watching").order("last_run_at", { ascending: true, nullsFirst: true }).limit(50);
        const due = (watches ?? []).filter((w) => !w.last_run_at || Date.now() - new Date(w.last_run_at).getTime() > DUE_MS).slice(0, 2);
        const { runAgentPipeline } = await import("@/lib/webagent-core.server");
        const results: { id: string; found: number; isNew: number }[] = [];
        for (const w of due) {
          await supabaseAdmin.from("searches").update({ last_run_at: new Date().toISOString() }).eq("id", w.id);
          try {
            const r = await runAgentPipeline(supabaseAdmin, w.user_id, w.query);
            if (r.ok) {
              results.push({ id: w.id, found: r.listingIds.length, isNew: r.newCount });
              if (r.newCount > 0) {
                const n = r.newCount;
                await supabaseAdmin.from("alerts").insert({ user_id: w.user_id, kind: "new_deal", severity: "opportunity",
                  title: `Hlídací pes: ${n} ${n === 1 ? "nový inzerát" : n < 5 ? "nové inzeráty" : "nových inzerátů"}`, body: w.query });
              }
            }
          } catch (e) { console.error("[cron watchdog]", e); }
        }
        if (due.length) {
          try { const { refreshLiveMarketStats } = await import("@/lib/market-refresh.server"); await refreshLiveMarketStats(); }
          catch (e) { console.error("[cron watchdog] market", e); }
        }
        return Response.json({ ran: due.length, results });
      },
    },
  },
});
