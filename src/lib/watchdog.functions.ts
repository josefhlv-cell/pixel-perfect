/**
 * Watchdog ("hlídací pes"): saved Web Agent queries re-run once a day. Results flow
 * through the same pipeline and create in-app alerts (new deal / price drop /
 * availability change). Runs when the user opens the app and the last run is >20 h old.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const WATCH = "watching";
const DUE_MS = 20 * 3600_000;

export const listWatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("searches").select("id,query,last_run_at,created_at")
      .eq("user_id", context.userId).eq("status", WATCH).order("created_at", { ascending: false });
    return data ?? [];
  });

export const addWatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ query: z.string().trim().min(3).max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    const { count } = await context.supabase.from("searches").select("id", { count: "exact", head: true })
      .eq("user_id", context.userId).eq("status", WATCH);
    if ((count ?? 0) >= 5) return { ok: false as const, error: "Maximálně 5 hlídaných hledání." };
    const { error } = await context.supabase.from("searches").insert({ user_id: context.userId, query: data.query, status: WATCH, provider: "web_agent" });
    if (error) return { ok: false as const, error: "Uložení selhalo." };
    return { ok: true as const };
  });

export const removeWatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("searches").update({ status: "stopped" }).eq("id", data.id).eq("user_id", context.userId);
    return { ok: true as const };
  });

/** Runs every due watch for the signed-in user (at most 2 per call to bound cost). */
export const runDueWatches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: watches } = await supabase.from("searches").select("id,query,last_run_at")
      .eq("user_id", userId).eq("status", WATCH);
    const due = (watches ?? []).filter((w) => !w.last_run_at || Date.now() - new Date(w.last_run_at).getTime() > DUE_MS).slice(0, 2);
    if (due.length === 0) return { ran: 0, found: 0 };
    const { runAgentPipeline } = await import("./webagent-core.server");
    let found = 0;
    for (const w of due) {
      // Mark first so parallel tabs don't run the same watch twice.
      await supabase.from("searches").update({ last_run_at: new Date().toISOString() }).eq("id", w.id);
      try {
        const r = await runAgentPipeline(supabase, userId, w.query);
        if (r.ok) found += r.listingIds.length;
        if (r.ok && r.newCount > 0) await notifyWatch(supabase, userId, w.query, r.newCount);
      } catch (e) {
        console.error("[watchdog] run failed", e);
      }
    }
    try {
      const { refreshLiveMarketStats } = await import("./market-refresh.server");
      await refreshLiveMarketStats();
    } catch (e) { console.error("[watchdog] market refresh", e); }
    return { ran: due.length, found };
  });

async function notifyWatch(supabase: { from: (t: "alerts") => { insert: (v: never) => PromiseLike<unknown> } }, userId: string, query: string, n: number) {
  await supabase.from("alerts").insert({ user_id: userId, kind: "new_deal", severity: "opportunity",
    title: `Hlídací pes: ${n} ${n === 1 ? "nový inzerát" : n < 5 ? "nové inzeráty" : "nových inzerátů"}`, body: query } as never);
}
