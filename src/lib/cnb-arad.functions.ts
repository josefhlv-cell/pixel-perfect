import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Signed-in users only. Imports ČNB ARAD sets into append-only evidence. */
export const importCnbArad = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ setIds: z.string().regex(/^\d{1,6}(,\d{1,6}){0,9}$/).optional() }).parse(d ?? {}))
  .handler(async ({ data }) => {
    const { importAradSet, DEFAULT_SET_IDS, AradError } = await import("./future-os/adapters/cnb-arad.server");
    const ids = (data.setIds ?? DEFAULT_SET_IDS).split(",");
    const results = [];
    for (const id of ids) {
      try { results.push({ ok: true as const, ...(await importAradSet(id)) }); }
      catch (e) {
        const msg = e instanceof AradError ? e.message : "Import selhal.";
        if (!(e instanceof AradError)) console.error("[cnb-arad] unexpected", e);
        results.push({ ok: false as const, setId: id, error: msg });
      }
    }
    return { results, finishedAt: new Date().toISOString() };
  });

/** Count + last retrieval time of ČNB evidence (RLS: authenticated read). */
export const cnbAradStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: src } = await context.supabase.from("reality_evidence_sources").select("id").eq("independence_group", "cnb").maybeSingle();
    if (!src) return { count: 0, lastRetrievedAt: null as string | null };
    const { count } = await context.supabase.from("reality_evidence").select("id", { count: "exact", head: true }).eq("source_id", src.id);
    const { data: last } = await context.supabase.from("reality_evidence").select("retrieved_at").eq("source_id", src.id).order("retrieved_at", { ascending: false }).limit(1).maybeSingle();
    return { count: count ?? 0, lastRetrievedAt: last?.retrieved_at ?? null };
  });
