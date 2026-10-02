import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Reality Investor — investiční inteligence pro české nemovitosti" },
      { name: "description", content: "Najděte investiční byty s transparentním Deal Priority, spočítejte výnos a cash-flow a sledujte portfolio." },
      { property: "og:title", content: "Reality Investor" },
      { property: "og:description", content: "Deal Hunter, kalkulačka výnosů, portfolio a AI analytik pro české nemovitosti." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 items-center justify-between border-b px-4 sm:px-8">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded bg-primary font-mono text-xs font-bold text-primary-foreground">RI</span>
          <span className="text-sm font-semibold">Reality Investor</span>
        </div>
        <Button asChild size="sm" variant="outline"><Link to="/auth">Přihlásit</Link></Button>
      </header>
      <main className="mx-auto flex max-w-4xl flex-1 flex-col justify-center px-4 py-16 sm:px-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Investor terminal · CZ</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">{t("app.tagline")}.</h1>
        <p className="mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Deal Priority s otevřeným výpočtem, odhad hodnoty a nájmu, cash-flow při reálném financování, hlídání čerstvosti nabídek a AI analytik, který nepřepočítává vaše čísla.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg"><Link to="/auth" search={{ mode: "signup" }}>Vytvořit účet</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/auth">Přihlásit se</Link></Button>
        </div>
        <div className="mt-14 grid gap-px overflow-hidden rounded-md border bg-border sm:grid-cols-3">
          {[
            ["Deal Hunter", "Proč deal sedí – a proč ne. Každý bod skóre je vidět."],
            ["Kalkulačka", "Splátka, cash-on-cash, IRR, equity a total return okamžitě."],
            ["Freshness", "Ověřená dostupnost a stáří nabídky u každého inzerátu."],
          ].map(([h, d]) => (
            <div key={h} className="bg-card p-5">
              <div className="text-sm font-semibold">{h}</div>
              <div className="mt-1 text-sm text-muted-foreground">{d}</div>
            </div>
          ))}
        </div>
        <p className="mt-10 text-xs text-muted-foreground">{t("disclaimer")}</p>
      </main>
    </div>
  );
}
