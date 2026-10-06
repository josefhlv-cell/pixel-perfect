<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Supabase client keeps public URL/publishable-key literal fallbacks in client.ts — published builds have shipped without VITE_* values, which silently produced a no-op client.
- Web Agent pipeline lives in src/lib/webagent-core.server.ts and is shared by the Deal Hunter action and the watchdog — keep one pipeline so dedup/freshness rules stay identical.
- Firecrawl (direct API, FIRECRAWL_API_KEY) is tried first for opening and searching pages — it renders JavaScript portals that plain fetch cannot read.
- Live market stats are recomputed server-side from non-sample listings into market_statistics (is_sample=false); rent per m² carries over because sale ads don't show rent.
- Listings/properties and their child rows are readable only by their creator (or when is_sample); uniqueness is (created_by, source_url) — every user owns their own copy of a found ad so data never leaks between accounts.
- Daily watchdog runs server-side via pg_cron hourly → /api/public/cron/watchdog (each watch is due after 20 h); the in-app runDueWatches stays as a fallback.
- Firecrawl portal search uses 3 requests (open web + two OR-ed site: groups) and retries once on 429 — the plan has a low per-minute limit.
