import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { mode?: "signup" } => (s["mode"] === "signup" ? { mode: "signup" } : {}),
  head: () => ({
    meta: [
      { title: "Přihlášení — Deal-Hunt" },
      { name: "description", content: "Přihlaste se nebo si vytvořte účet v Deal-Hunt." },
      { property: "og:title", content: "Přihlášení — Deal-Hunt" },
      { property: "og:description", content: "Přístup k Deal Hunteru, portfoliu a AI analytikovi." },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("Neplatný e-mail").max(255),
  password: z.string().min(8, "Heslo musí mít alespoň 8 znaků").max(72),
});

function authErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lower = message.toLowerCase();
  if (lower.includes("missing supabase") || lower.includes("connect supabase") || lower.includes("supabase_url") || lower.includes("publishable_key")) {
    return "Připojení k databázi není nakonfigurované. Zkontrolujte Supabase nastavení aplikace.";
  }
  if (lower.includes("invalid login") || lower.includes("invalid credentials")) return "Nesprávný e-mail nebo heslo.";
  if (lower.includes("email not confirmed") || lower.includes("confirm your email") || lower.includes("email_not_confirmed")) return "E-mail zatím není potvrzen. Zkontrolujte doručenou poštu a potvrďte účet.";
  if (lower.includes("rate limit") || lower.includes("too many requests")) return "Příliš mnoho pokusů. Chvíli počkejte a zkuste to znovu.";
  if (lower.includes("user already registered") || lower.includes("already registered")) return "Účet s tímto e-mailem už existuje. Zkuste se přihlásit.";
  if (lower.includes("signup is disabled")) return "Registrace je momentálně vypnutá v nastavení Supabase.";
  if (lower.includes("failed to fetch") || lower.includes("network")) return "Nepodařilo se spojit se serverem. Zkontrolujte připojení a zkuste to znovu.";
  return message || "Nepodařilo se dokončit požadavek.";
}

function AuthPage() {
  const { mode: initial } = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">(initial === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) return void toast.error(parsed.error.issues[0]!.message);
    setBusy(true);
    try {
      if (mode === "signin") {
        const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error) throw error;
        if (!data.session || !data.user) throw new Error("Přihlášení nevrátilo platnou relaci. Zkontrolujte Supabase Auth konfiguraci.");
        navigate({ to: "/dashboard" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          ...parsed.data,
          options: { emailRedirectTo: `${window.location.origin}/dashboard`, data: { display_name: name.trim() || null } },
        });
        if (error) throw error;
        if (data.session && data.user) {
          toast.success("Účet byl vytvořen a jste přihlášen.");
          navigate({ to: "/dashboard" });
        } else if (data.user) {
          toast.success("Účet byl vytvořen. Potvrďte prosím e-mail – odkaz vám musí dorazit z Supabase Auth.");
        } else {
          throw new Error("Registrace nevrátila uživatele. Zkontrolujte Supabase Auth a e-mailové nastavení.");
        }
      }
    } catch (err) {
      console.error("[auth] request failed", err);
      toast.error(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded bg-primary font-mono text-xs font-bold text-primary-foreground">DH</span>
          <span className="font-semibold">Deal-Hunt</span>
        </Link>
        <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Přihlášení</TabsTrigger>
            <TabsTrigger value="signup">Registrace</TabsTrigger>
          </TabsList>
        </Tabs>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Jméno</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Heslo</Label>
              {mode === "signin" && <Link to="/forgot-password" className="text-xs text-primary hover:underline">Zapomenuté heslo?</Link>}
            </div>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={mode === "signin" ? "current-password" : "new-password"} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Pracuji…" : mode === "signin" ? "Přihlásit se" : "Vytvořit účet"}
          </Button>
        </form>
      </div>
    </div>
  );
}
