import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { alertsQuery, uid } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import { formatRelative } from "@/lib/format";
import { pageHead } from "@/lib/head";
import { t } from "@/lib/i18n";
import { Empty, PageHeader, Section } from "@/components/app/shared";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const ALERT_TYPES = [
  ["new_deal", "Nový potenciální deal"],
  ["price_drop", "Pokles ceny"],
  ["availability_change", "Změna dostupnosti"],
  ["priority_change", "Změna Deal Priority"],
  ["stale_listing", "Zastaralá nabídka"],
  ["removed_listing", "Odstraněná nabídka"],
  ["reappeared_listing", "Znovuobjevená nabídka"],
  ["value_change", "Změna odhadované hodnoty"],
  ["rent_change", "Změna nájmu"],
] as const;

export const notifQuery = {
  queryKey: ["notification-settings"],
  queryFn: async () => {
    const { data } = await supabase.from("notification_settings").select("prefs").maybeSingle();
    return (data?.prefs ?? {}) as Record<string, boolean>;
  },
};

export async function saveNotif(prefs: Record<string, boolean>) {
  const { error } = await supabase.from("notification_settings").upsert({ user_id: await uid(), prefs, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => pageHead("Alerty", "Alert Center: změny cen, dostupnosti, čerstvosti a nové dealy."),
  loader: ({ context }) => context.queryClient.ensureQueryData(alertsQuery),
  component: Alerts,
});

const sevTone: Record<string, string> = { opportunity: "border-l-positive", warning: "border-l-warning", info: "border-l-chart-3" };

export function NotificationSettings() {
  const qc = useQueryClient();
  const { data: prefs } = useQuery(notifQuery);
  const toggle = async (k: string, v: boolean) => {
    const next = { ...(prefs ?? {}), [k]: v };
    qc.setQueryData(notifQuery.queryKey, next);
    try { await saveNotif(next); } catch { toast.error("Nastavení se nepodařilo uložit"); }
  };
  return (
    <div className="space-y-2.5">
      {ALERT_TYPES.map(([k, label]) => (
        <div key={k} className="flex items-center justify-between">
          <Label htmlFor={`n-${k}`} className="text-sm font-normal">{label}</Label>
          <Switch id={`n-${k}`} checked={prefs?.[k] ?? true} onCheckedChange={(c) => toggle(k, c)} />
        </div>
      ))}
      <div className="flex items-center justify-between border-t pt-2.5">
        <Label htmlFor="n-email" className="text-sm font-normal">Také e-mailem</Label>
        <Switch id="n-email" checked={prefs?.["email"] ?? false} onCheckedChange={(c) => toggle("email", c)} />
      </div>
    </div>
  );
}

function Alerts() {
  const { data } = useSuspenseQuery(alertsQuery);
  const qc = useQueryClient();
  const markAll = async () => {
    await supabase.from("alerts").update({ read_at: new Date().toISOString() }).is("read_at", null);
    qc.invalidateQueries({ queryKey: ["alerts"] });
  };
  const label = (k: string) => ALERT_TYPES.find(([x]) => x === k)?.[1] ?? k;
  return (
    <div className="space-y-4">
      <PageHeader title="Alert Center" actions={data.some((a) => !a.read_at) && <Button size="sm" variant="outline" onClick={markAll}>Označit vše jako přečtené</Button>} />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-2">
          {data.length === 0 ? <Empty>{t("empty.alerts")}</Empty> : data.map((a) => (
            <div key={a.id} className={cn("rounded-md border border-l-4 bg-card p-3", sevTone[a.severity], a.read_at && "opacity-60")}>
              <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{label(a.kind)}</span><span>{formatRelative(a.created_at)}</span></div>
              <div className="mt-1 text-sm font-medium">{a.title}</div>
              {a.body && <div className="text-sm text-muted-foreground">{a.body}</div>}
            </div>
          ))}
        </div>
        <Section title="Nastavení notifikací"><NotificationSettings /></Section>
      </div>
    </div>
  );
}
