# Reality Investor (pixel-perfect)

Investiční inteligence pro české nemovitosti — Deal Hunter, portfolio, kalkulačka výnosů, AI analytik a mapa.

Built with [Lovable](https://lovable.dev) · stack: TanStack Start, React 19, Supabase, Drizzle, Tailwind, MapLibre.

## Hlavní funkce

- **Deal Hunter** – filtry (lokalita, vzdálenost od adresy, výnos, sleva…), uložené filtry, porovnání až 3 dealů, export CSV, AI Web Agent
- **Deal Priority** – transparentní skóre (sleva, výnos, čerstvost, dostupnost, pokles ceny)
- **Portfolio** – hodnota, equity, cash-flow, grafy
- **Kalkulačka** – hypotéční předvolby, scénáře (optimistický / realistický / pesimistický), orientační daň z nájmu
- **Watchlist & alerty** – historie cen, notifikace (vč. generování při poklesu ceny z Web Agentu)
- **AI analýzy** – property / deal / risks / due diligence / market (čísla z výpočetního jádra)

## Development

```sh
git clone <this-repository-url>
cd pixel-perfect
cp .env.example .env   # vyplň Supabase klíče
npm i
npm run dev
```

Nikdy necommituj `.env`. Šablona je v `.env.example`.

## Lovable

Pokračuj v editoru: https://lovable.dev/projects/9ec4accc-42fa-473d-b423-03251a087cef
