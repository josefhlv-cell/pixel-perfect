/**
 * Real market data: aggregates asking price per m² from LIVE (non-sample) listings
 * found by the Web Agent and stores them as non-sample market_statistics rows.
 * Rent per m² is not observable from sale listings, so it carries over the latest
 * known value for the city (or stays null). Server-only, uses the admin client
 * because market_statistics is read-only for users.
 */
export async function refreshLiveMarketStats(): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - 90 * 86400_000).toISOString();
  const { data: rows } = await supabaseAdmin
    .from("listings")
    .select("price,area_m2,location,availability_status")
    .eq("is_sample", false)
    .gte("last_seen_at", since);
  const byCity = new Map<string, number[]>();
  for (const r of rows ?? []) {
    if (!r.price || !r.area_m2 || !r.location) continue;
    if (r.availability_status === "SOLD" || r.availability_status === "REMOVED") continue;
    const city = r.location.split(/[,–-]/)[0]!.trim();
    if (!city) continue;
    const ppm = r.price / Number(r.area_m2);
    if (!Number.isFinite(ppm) || ppm < 5_000 || ppm > 500_000) continue;
    byCity.set(city, [...(byCity.get(city) ?? []), ppm]);
  }
  const period = new Date().toISOString().slice(0, 10);
  let written = 0;
  for (const [city, vals] of byCity) {
    vals.sort((a, b) => a - b);
    const median = Math.round(vals[Math.floor(vals.length / 2)]!);
    const { data: prev } = await supabaseAdmin
      .from("market_statistics").select("avg_rent_m2").eq("city", city)
      .not("avg_rent_m2", "is", null).order("period", { ascending: false }).limit(1).maybeSingle();
    const { data: existing } = await supabaseAdmin
      .from("market_statistics").select("id").eq("city", city).eq("period", period).eq("is_sample", false).maybeSingle();
    const row = { avg_asking_price_m2: median, avg_rent_m2: prev?.avg_rent_m2 ?? null, listings_count: vals.length };
    const res = existing
      ? await supabaseAdmin.from("market_statistics").update(row).eq("id", existing.id)
      : await supabaseAdmin.from("market_statistics").insert({ ...row, city, period, is_sample: false });
    if (res.error) console.error("[market] write", city, res.error.message);
    else written++;
  }
  return written;
}
