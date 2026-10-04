/**
 * AI Web Agent for Deal Hunter: SEARCH → OPEN → EXTRACT → NORMALIZE → SAVE (LIVE)
 * → FRESHNESS (existing engine). Valuation/calculation/Deal Priority run in the
 * existing enrichment on read. Never creates fake live data.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeFreshnessScore, computeFreshnessStatus, decideAvailability, isLikelyDuplicate } from "./freshness";
import { canonicalUrl, isUsable, LIVE_SOURCE_TYPE } from "./webagent";

const MAX_PAGES = 12;
const OPEN_RETRIES = 2;

async function openWithRetry(
  agent: { open: (url: string) => Promise<{ url: string; http: number; html: string | null }> },
  url: string,
): Promise<{ url: string; http: number; html: string | null }> {
  let last = await agent.open(url);
  for (let i = 0; i < OPEN_RETRIES; i++) {
    // Retry only on timeout / network / 429 / 503
    if (last.html || (last.http !== 0 && last.http !== 429 && last.http !== 503)) break;
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    last = await agent.open(url);
  }
  return last;
}

export const runWebAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ query: z.string().trim().min(3).max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { WebAgentProvider } = await import("./ai/WebAgentProvider.server");
    let agent;
    try {
      agent = new WebAgentProvider(process.env["LOVABLE_API_KEY"] ?? "");
    } catch {
      return { ok: false as const, error: "Webové vyhledávání není momentálně dostupné (chybí API klíč)." };
    }

    let urls: string[];
    try {
      urls = await agent.search(data.query);
    } catch (e) {
      console.error("[webagent] search failed", e);
      return { ok: false as const, error: "Webové vyhledávání není momentálně dostupné." };
    }

    if (urls.length === 0) {
      return { ok: true as const, pagesFound: 0, analyzed: 0, listingIds: [], failed: [] };
    }

    const candidates = urls.slice(0, MAX_PAGES);
    const failed: { url: string; reason: string }[] = [];
    const listingIds: string[] = [];

    const { data: existingProps } = await supabase.from("properties").select("id,city,area_m2,disposition,latitude,longitude");

    await Promise.all(
      candidates.map(async (url) => {
        const page = await openWithRetry(agent, url);
        if (!page.html) {
          failed.push({
            url,
            reason:
              page.http === 404 || page.http === 410
                ? "404 – stránka neexistuje"
                : page.http === 429 || page.http === 503
                  ? `Dočasně nedostupné (HTTP ${page.http})"
                  : `Inzerát se nepodařilo načíst (HTTP ${page.http || "timeout"})`,
          });
          return;
        }
        let ex;
        try {
          ex = await agent.extractListing(url, agent.read(page));
        } catch {
          failed.push({ url, reason: "Extrakce selhala" });
          return;
        }
        if (!isUsable(ex)) {
          failed.push({ url, reason: "Není detail inzerátu s cenou" });
          return;
        }
        const sourceUrl = canonicalUrl(url) ?? url;
        const now = new Date();

        // Dedup 1: same source URL → reuse the single listing.
        const { data: existing } = await supabase.from("listings").select("*").eq("source_url", sourceUrl).maybeSingle();

        // Freshness via existing engine (page loaded with HTTP 200).
        const decision = decideAvailability({
          previousStatus: (existing?.availability_status as never) ?? "UNKNOWN",
          previousPrice: existing?.price ?? null,
          outcome: { kind: "ok", http: 200, statusMarker: ex.statusMarker, price: ex.price },
        });
        const verifiedAt = decision.verified ? now : existing?.last_verified_at ? new Date(existing.last_verified_at) : null;
        const freshness = computeFreshnessStatus(verifiedAt, now, ex.published_at ? new Date(ex.published_at) : null);
        const fresh = {
          availability_status: decision.newStatus,
          availability_confidence: decision.confidence,
          freshness_status: freshness,
          freshness_score: computeFreshnessScore(verifiedAt, now),
          last_seen_at: now.toISOString(),
          last_verified_at: verifiedAt?.toISOString() ?? null,
          price: decision.newPrice,
        };

        let listingId: string;
        if (existing) {
          listingId = existing.id;
          if (existing.created_by === userId) await supabase.from("listings").update(fresh).eq("id", existing.id);
        } else {
          // Dedup 2: canonical property across portals (existing duplicate heuristic).
          const city = ex.location;
          const match = (existingProps ?? []).find((p) =>
            isLikelyDuplicate(
              { city, area_m2: ex.area_m2, rooms: ex.rooms, lat: ex.latitude, lng: ex.longitude },
              { city: p.city, area_m2: p.area_m2 == null ? null : Number(p.area_m2), rooms: p.disposition, lat: p.latitude, lng: p.longitude },
            ),
          );
          let propertyId = match?.id;
          if (!propertyId) {
            const { data: prop, error } = await supabase
              .from("properties")
              .insert({
                created_by: userId, is_sample: false, property_type: ex.property_type, disposition: ex.rooms, area_m2: ex.area_m2,
                city, address: ex.address, latitude: ex.latitude, longitude: ex.longitude, condition: ex.condition, floor: ex.floor, description: ex.description,
              })
              .select("id")
              .single();
            if (error || !prop) {
              failed.push({ url, reason: "Uložení selhalo" });
              return;
            }
            propertyId = prop.id;
            existingProps?.push({ id: prop.id, city, area_m2: ex.area_m2, disposition: ex.rooms, latitude: ex.latitude, longitude: ex.longitude });
          }
          const { data: ins, error } = await supabase
            .from("listings")
            .insert({
              ...fresh, property_id: propertyId, created_by: userId, is_sample: false, source_type: LIVE_SOURCE_TYPE,
              source_url: sourceUrl, source_domain: ex.source_domain, title: ex.title, currency: ex.currency ?? "CZK",
              area_m2: ex.area_m2, rooms: ex.rooms, property_type: ex.property_type, location: city, address: ex.address,
              latitude: ex.latitude, longitude: ex.longitude, source_published_at: ex.published_at, source_updated_at: ex.updated_at,
            })
            .select("id")
            .single();
          if (error || !ins) {
            console.error("[webagent] listing insert", error);
            failed.push({ url, reason: "Uložení selhalo" });
            return;
          }
          listingId = ins.id;
        }
        await supabase.from("listing_freshness_events").insert(
          decision.events.map((ev) => ({
            listing_id: listingId, event_type: ev.type, http_status: ev.http ?? null, previous_status: (existing?.availability_status as never) ?? "UNKNOWN",
            new_status: decision.newStatus, freshness_status: freshness, details: { ...(ev.details ?? {}), source: "web_agent" } as never,
          })),
        );
        await supabase.from("listing_snapshots").insert({
          listing_id: listingId, price: decision.newPrice, availability_status: decision.newStatus,
          raw: { ownership: ex.ownership, balcony: ex.balcony, terrace: ex.terrace, parking: ex.parking, elevator: ex.elevator } as never,
        });
        listingIds.push(listingId);
      }),
    );

    return { ok: true as const, pagesFound: urls.length, analyzed: candidates.length, listingIds: [...new Set(listingIds)], failed };
  });
