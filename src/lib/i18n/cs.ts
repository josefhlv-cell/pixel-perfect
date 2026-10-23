export const cs = {
  app: { name: "Reality Investor", tagline: "Přehled nemovitostí, nájmů a nákladů na jednom místě" },
  nav: {
    dashboard: "Přehled",
    dealHunter: "Hledání nabídek",
    properties: "Nemovitosti",
    portfolio: "Moje nemovitosti",
    watchlist: "Oblíbené",
    market: "Trh",
    calculator: "Kalkulačka",
    alerts: "Upozornění",
    aiAnalyst: "Pomocník",
    settings: "Nastavení",
  },
  common: {
    unknown: "Neuvedeno",
    sample: "UKÁZKOVÁ DATA",
    openListing: "Otevřít inzerát",
    analyzeAi: "Vysvětlit nabídku",
    saveDeal: "Uložit nabídku",
    saved: "Uloženo",
    signOut: "Odhlásit",
    providerNotConnected: "Datový zdroj není připojen",
  },
  errors: {
    aiUnavailable:
      "Automatické vysvětlení je momentálně nedostupná. Výpočty a uložená data zůstávají dostupná.",
    discoveryUnavailable: "Vyhledávání se nepodařilo dokončit.",
    generic: "Něco se nepovedlo. Zkuste to prosím znovu.",
  },
  disclaimer:
    "Reality Investor je analytický nástroj pro práci s informacemi o nemovitostech. Výsledky, odhady a scénáře nejsou investičním, finančním, právním ani daňovým poradenstvím ani zárukou budoucího výnosu. Před rozhodnutím ověřte aktuálnost údajů a zvažte odbornou konzultaci.",
  freshness: {
    FRESH: "Čerstvé",
    RECENT: "Nedávné",
    AGING: "Stárnoucí",
    STALE: "Zastaralé",
    EXPIRED: "Expirované",
    UNKNOWN: "Neznámé",
  },
  availability: {
    ACTIVE_CONFIRMED: "Aktivní · ověřeno",
    ACTIVE_UNCONFIRMED: "Aktivní · neověřeno",
    RESERVED: "Rezervováno",
    SOLD: "Prodáno",
    REMOVED: "Staženo ze zdroje",
    EXPIRED: "Expirováno",
    UNKNOWN: "Neznámý stav",
  },
  empty: {
    portfolio:
      "Zatím nemáte žádné nemovitosti mezi vlastními nemovitostmi. Přidejte první nemovitost nebo vyhledejte nabídky.",
    watchlist: "Zatím nemáte oblíbené nabídky. Uložte si nabídku z Hledání nabídek.",
    alerts: "Žádná upozornění. Jakmile se změní cena nebo stav sledované nemovitosti, uvidíte to tady.",
  },
} as const;
