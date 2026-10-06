/** Shared Web Agent pipeline (used by the Deal Hunter action and the daily watchdog). Server-only. */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { computeFreshnessScore, computeFreshnessStatus, decideAvailability, isLikelyDuplicate } from "./freshness";
import { canonicalUrl, detailLinksFrom, isUsable, LIVE_SOURCE_TYPE } from "./webagent";

const MAX_PAGES = 8;
const OPEN_RETRIES = 2;

async function openWithRetry(
  agent: { open: (url: string) => Promise<{ url: string; http: number; html: string | null; links?: string[] }> },
  url: string,
) {
  let last = await agent.open(url);
  for (let i = 0; i < OPEN_RETRIES; i++) {
    if (last.html || (last.http !== 0 && last.http !== 429 && last.http !== 503)) break;
    await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    last = await agent.open(url);
  }
  return last;
}

export async function runAgentPipeline(supabase: SupabaseClient<Database>, userId: string, query: string) {
  const data = { query };
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

    // Process candidates sequentially. This prevents concurrent searches from
    // racing on duplicate detection / property creation and avoids firing many
    // extraction calls at once, which was the main source of rate-limit risk.
    for (const url of candidates) {
      const page = await openWithRetry(agent, url);
      if (!page.html) {
        failed.push({
          url,
          reason:
            page.http === 404 || page.http === 410
              ? "404 – stránka neexistuje"
              : page.http === 429 || page.http === 503
                ? `Dočasně nedostupné (HTTP ${page.http})`
                : `Inzerát se nepodařilo načíst (HTTP ${page.http || "timeout"})`,
        });
        continue;
      }

      let ex;
      try {
        ex = await agent.extractListing(url, agent.read(page));
      } catch {
        failed.push({ url, reason: "Extrakce selhala" });
        continue;
      }
      if (!isUsable(ex)) {
        failed.push({ url, reason: "Není detail inzerátu s cenou" });
        continue;
      }

      const sourceUrl = canonicalUrl(url) ?? url;
      const now = new Date();
      const { data: existing } = await supabase.from("listings").select("*").eq("source_url", sourceUrl).maybeSingle();

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
      let isNew = false;
      if (existing) {
        listingId = existing.id;
        if (existing.created_by === userId) await supabase.from("listings").update(fresh).eq("id", existing.id);
      } else {
        isNew = true;
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
            continue;
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
          continue;
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

      const title = ex.title ?? sourceUrl;
      try {
        if (isNew) {
          await supabase.from("alerts").insert({
            user_id: userId, kind: "new_deal", severity: "opportunity", title: "Nový potenciální deal", body: title, listing_id: listingId,
          });
        }
        const priceDrop = decision.events.some((ev) => ev.type === "price_decrease");
        if (priceDrop && existing?.price != null && decision.newPrice != null) {
          await supabase.from("alerts").insert({
            user_id: userId, kind: "price_drop", severity: "opportunity", title: "Pokles ceny",
            body: `${title}: ${existing.price.toLocaleString("cs-CZ")} → ${decision.newPrice.toLocaleString("cs-CZ")} Kč`, listing_id: listingId,
          });
        }
        const availChange = existing && existing.availability_status && decision.newStatus !== existing.availability_status;
        if (availChange) {
          await supabase.from("alerts").insert({
            user_id: userId, kind: "availability_change", severity: "warning", title: "Změna dostupnosti",
            body: `${title}: ${existing!.availability_status} → ${decision.newStatus}`, listing_id: listingId,
          });
        }
      } catch (alertErr) {
        console.error("[webagent] alert insert", alertErr);
      }

      listingIds.push(listingId);
    }

    return { ok: true as const, pagesFound: urls.length, analyzed: candidates.length, listingIds: [...new Set(listingIds)], failed };
}
