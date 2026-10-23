/** Browser-side data access (RLS applies as the signed-in user). */
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { enrichListing, latestStatsByCity } from "./deals";
import { onlyLive } from "./live-data";

async function uid() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Nepřihlášen");
  return data.user.id;
}

export const listingsQuery = queryOptions({
  queryKey: ["listings"],
  queryFn: async () => {
    const [l, p, m, s] = await Promise.all([
      onlyLive(supabase.from("listings").select("*")).order("created_at", { ascending: false }),
      onlyLive(supabase.from("properties").select("*")),
      onlyLive(supabase.from("market_statistics").select("*")),
      supabase
        .from("listing_snapshots")
        .select("id,listing_id,price,availability_status,observed_at"),
    ]);
    for (const r of [l, p, m, s]) if (r.error) throw r.error;
    const props = new Map((p.data ?? []).map((x) => [x.id, x]));
    const stats = latestStatsByCity(m.data ?? []);
    // Comparable evidence is drawn only from the same production-only listing set
    // already loaded above. The target listing and duplicate property are excluded
    // inside the model; city-level averages are never used as a substitute.
    const saleComparables = (l.data ?? []).flatMap((row) => {
      const prop = props.get(row.property_id);
      const areaM2 = row.area_m2 == null ? null : Number(row.area_m2);
      const priceCzk = row.price == null ? null : Number(row.price);
      const city = prop?.city ?? row.location;
      const observedAt = row.last_verified_at ?? row.last_seen_at ?? row.updated_at ?? row.created_at;
      if (!city || !areaM2 || areaM2 <= 0 || !priceCzk || priceCzk <= 0 || !row.source_url || !observedAt) {
        return [];
      }
      const locationParts = (row.location ?? city).split(/[,–-]/).map((part) => part.trim());
      return [{
        listingId: row.id,
        propertyId: row.property_id,
        sourceUrl: row.source_url,
        city,
        district: locationParts.length > 1 ? locationParts.slice(1).join(", ") : null,
        rooms: row.rooms,
        propertyType: row.property_type,
        areaM2,
        priceCzk,
        observedAt,
        availability: row.availability_status,
        freshness: row.freshness_status,
        isSample: row.is_sample || (prop?.is_sample ?? false),
      }];
    });
    return (l.data ?? [])
      .map((x) =>
        enrichListing(x, props.get(x.property_id) ?? null, stats, (s.data ?? []) as never, saleComparables),
      )
      .sort((a, b) => b.priority - a.priority);
  },
});

export const marketQuery = queryOptions({
  queryKey: ["market"],
  queryFn: async () => {
    const { data, error } = await onlyLive(supabase.from("market_statistics").select("*")).order(
      "period",
    );
    if (error) throw error;
    return data;
  },
});

export const watchlistQuery = queryOptions({
  queryKey: ["watchlist"],
  queryFn: async () => {
    const { data: listings, error: listingsError } = await onlyLive(
      supabase.from("listings").select("id"),
    );
    if (listingsError) throw listingsError;
    if (!listings?.length) return [];
    const { data, error } = await supabase
      .from("watchlist")
      .select("*")
      .in(
        "listing_id",
        listings.map((row) => row.id),
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const freshnessEventsQuery = queryOptions({
  queryKey: ["freshness-events"],
  queryFn: async () => {
    const { data: listings, error: listingsError } = await onlyLive(
      supabase.from("listings").select("id"),
    );
    if (listingsError) throw listingsError;
    if (!listings?.length) return [];
    const { data, error } = await supabase
      .from("listing_freshness_events")
      .select("*")
      .in(
        "listing_id",
        listings.map((row) => row.id),
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return data;
  },
});

export const portfolioQuery = queryOptions({
  queryKey: ["portfolio"],
  queryFn: async () => {
    const [p, v, t] = await Promise.all([
      supabase.from("portfolio_properties").select("*").order("created_at"),
      supabase.from("portfolio_valuations").select("*").order("valued_on"),
      supabase
        .from("portfolio_transactions")
        .select("*")
        .order("occurred_on", { ascending: false }),
    ]);
    for (const r of [p, v, t]) if (r.error) throw r.error;
    return { properties: p.data!, valuations: v.data!, transactions: t.data! };
  },
});

export const alertsQuery = queryOptions({
  queryKey: ["alerts"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("alerts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const profileQuery = queryOptions({
  queryKey: ["profile"],
  queryFn: async () => {
    const id = await uid();
    const [p, i, u] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("investor_profiles")
        .select("*")
        .eq("user_id", id)
        .order("created_at")
        .limit(1)
        .maybeSingle(),
      supabase.auth.getUser(),
    ]);
    return { profile: p.data, investor: i.data, email: u.data.user?.email ?? null, userId: id };
  },
});

export async function addToWatchlist(listingId: string) {
  const user_id = await uid();
  const { error } = await supabase.from("watchlist").insert({ user_id, listing_id: listingId });
  if (error && !String(error.message).includes("duplicate")) throw error;
}

export async function removeFromWatchlist(id: string) {
  const { error } = await supabase.from("watchlist").delete().eq("id", id);
  if (error) throw error;
}

export { uid };
