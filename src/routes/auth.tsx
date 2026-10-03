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
      { title: "Přihlášení — Reality Investor" },
      { name: "description", content: "Přihlaste se nebo si vytvořte účet v Reality Investor." },
      { property: "og:title", content: "Přihlášení — Reality Investor" },
      { property: "og:description", content: "Přístup k Deal Hunteru, portfoliu a AI analytikovi." },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email("Neplatný e-mail").max(255),
  password: z.string().min(8, "Heslo musí mít alespoň 8 znaků").max(72),
});

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
        const { error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error) throw new Error(error.message.includes("Invalid") ? "Nesprávný e-mail nebo heslo." : error.message.includes("confirm") ? "E-mail zatím není potvrzen." : error.message);
        navigate({ to: "/dashboard" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          ...parsed.data,
          options: { emailRedirectTo: `${window.location.origin}/dashboard`, data: { display_name: name.trim() || null } },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/dashboard" });
        else toast.success("Účet vytvořen. Potvrďte prosím e-mail – poslali jsme vám odkaz.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Něco se nepovedlo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded bg-primary font-mono text-xs font-bold text-primary-foreground">RI</span>
          <span className="font-semibold">Reality Investor</span>
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
