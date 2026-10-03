import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { profileQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/head";
import { t } from "@/lib/i18n";
import { PageHeader, Row, Section } from "@/components/app/shared";
import { NotificationSettings } from "./alerts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => pageHead("Nastavení", "Investiční profil, notifikace, AI a účet."),
  loader: ({ context }) => context.queryClient.ensureQueryData(profileQuery),
  component: Settings,
});

function Settings() {
  const { data } = useSuspenseQuery(profileQuery);
  const qc = useQueryClient();
  const inv = data.investor;
  const [v, setV] = useState({
    locations: inv?.locations?.join(", ") ?? "",
    strategy: inv?.strategy ?? "cashflow",
    maxPrice: inv?.max_price ? String(inv.max_price) : "",
    minYield: inv?.min_gross_yield_bps ? String(inv.min_gross_yield_bps / 100) : "",
    risk: inv?.risk_level ?? "medium",
    ltv: String((inv?.ltv_bps ?? 8000) / 100),
    rate: String((inv?.interest_rate_bps ?? 489) / 100),
  });
  const [name, setName] = useState(data.profile?.display_name ?? "");
  const num = (s: string) => Number(s.replace(",", "."));

  const saveProfile = async () => {
    const payload = {
      name: "Hlavní profil",
      locations: v.locations.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20),
      property_types: ["byt"],
      strategy: v.strategy,
      max_price: v.maxPrice ? Math.round(num(v.maxPrice)) : null,
      min_gross_yield_bps: v.minYield ? Math.round(num(v.minYield) * 100) : null,
      risk_level: v.risk,
      ltv_bps: Math.round(num(v.ltv) * 100),
      interest_rate_bps: Math.round(num(v.rate) * 100),
    };
    const { error } = inv ? await supabase.from("investor_profiles").update(payload).eq("id", inv.id) : await supabase.from("investor_profiles").insert({ ...payload, user_id: data.userId });
    if (error) return toast.error("Uložení se nepovedlo.");
    toast.success("Investiční profil uložen");
    qc.invalidateQueries({ queryKey: ["profile"] });
  };
  const saveName = async () => {
    const { error } = await supabase.from("profiles").update({ display_name: name.trim().slice(0, 80) || null }).eq("id", data.userId);
    if (error) return toast.error("Uložení se nepovedlo.");
    toast.success("Uloženo");
    qc.invalidateQueries({ queryKey: ["profile"] });
  };

  const field = (k: keyof typeof v, label: string, ph?: string) => (
    <div className="space-y-1">
      <Label htmlFor={`s-${k}`} className="text-xs text-muted-foreground">{label}</Label>
      <Input id={`s-${k}`} value={v[k]} placeholder={ph} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader title="Nastavení" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Investiční profil">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">{field("locations", "Cílové lokality", "Brno, Pardubice")}</div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Strategie</Label>
              <Select value={v.strategy} onValueChange={(s) => setV({ ...v, strategy: s })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="cashflow">Cash-flow</SelectItem><SelectItem value="appreciation">Růst hodnoty</SelectItem><SelectItem value="value_add">Value-add (rekonstrukce)</SelectItem><SelectItem value="balanced">Vyvážená</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Riziko</Label>
              <Select value={v.risk} onValueChange={(s) => setV({ ...v, risk: s })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="low">Nízké</SelectItem><SelectItem value="medium">Střední</SelectItem><SelectItem value="high">Vysoké</SelectItem></SelectContent>
              </Select>
            </div>
            {field("maxPrice", "Rozpočet – max. cena (Kč)")}
            {field("minYield", "Požadovaný výnos (%)")}
            {field("ltv", "Financování – LTV (%)")}
            {field("rate", "Financování – úrok (%)")}
          </div>
          <Button className="mt-4" size="sm" onClick={saveProfile}>Uložit profil</Button>
        </Section>
        <Section title="Notifikace"><NotificationSettings /></Section>
        <Section title="AI">
          <Row k="AI Provider" v="Lovable" />
          <Row k="Model" v="spravuje server" />
          <p className="mt-2 text-xs text-muted-foreground">API klíče jsou uložené pouze na serveru a nikdy se nezobrazují.</p>
        </Section>
        <Section title="Účet">
          <Row k="E-mail" v={data.email ?? "—"} />
          <Row k="Plán" v={<Badge variant="outline">{data.profile?.plan ?? "FREE"}</Badge>} />
          <p className="mb-3 mt-1 text-xs text-muted-foreground">Plán FREE / PRO lze změnit pouze přes platbu – nikoli z aplikace.</p>
          <div className="flex gap-2">
            <Input aria-label="Zobrazované jméno" value={name} onChange={(e) => setName(e.target.value)} placeholder="Zobrazované jméno" />
            <Button size="sm" variant="outline" onClick={saveName}>Uložit</Button>
          </div>
        </Section>
      </div>
      <p className="text-xs text-muted-foreground">{t("disclaimer")}</p>
    </div>
  );
}
