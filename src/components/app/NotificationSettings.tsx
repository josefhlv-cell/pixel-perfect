import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uid } from "@/lib/queries";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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

