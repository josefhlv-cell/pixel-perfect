/** Browser-side data access (RLS applies as the signed-in user). */
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { enrichListing, latestStatsByCity } from "./deals";

async function uid() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Nepřihlášen");
  return data.user.id;
}

export const listingsQuery = queryOptions({
  queryKey: ["listings"],
  queryFn: async () => {
    const [l, p, m, s] = await Promise.all([
      supabase.from("listings").select("*").order("created_at", { ascending: false }),
      supabase.from("properties").select("*"),
      supabase.from("market_statistics").select("*"),
      supabase.from("listing_snapshots").select("id,listing_id,price,availability_status,observed_at"),
    ]);
    for (const r of [l, p, m, s]) if (r.error) throw r.error;
    const props = new Map(p.data!.map((x) => [x.id, x]));
    const stats = latestStatsByCity(m.data!);
    return l.data!.map((x) => enrichListing(x, props.get(x.property_id) ?? null, stats, (s.data ?? []) as never)).sort((a, b) => b.priority - a.priority);
  },
});

export const marketQuery = queryOptions({
  queryKey: ["market"],
  queryFn: async () => {
    const { data, error } = await supabase.from("market_statistics").select("*").order("period");
    if (error) throw error;
    return data;
  },
});

export const watchlistQuery = queryOptions({
  queryKey: ["watchlist"],
  queryFn: async () => {
    const { data, error } = await supabase.from("watchlist").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const freshnessEventsQuery = queryOptions({
  queryKey: ["freshness-events"],
  queryFn: async () => {
    const { data, error } = await supabase.from("listing_freshness_events").select("*").order("created_at", { ascending: false }).limit(500);
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
      supabase.from("portfolio_transactions").select("*").order("occurred_on", { ascending: false }),
    ]);
    for (const r of [p, v, t]) if (r.error) throw r.error;
    return { properties: p.data!, valuations: v.data!, transactions: t.data! };
  },
});

export const alertsQuery = queryOptions({
  queryKey: ["alerts"],
  queryFn: async () => {
    const { data, error } = await supabase.from("alerts").select("*").order("created_at", { ascending: false });
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
      supabase.from("investor_profiles").select("*").eq("user_id", id).order("created_at").limit(1).maybeSingle(),
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
