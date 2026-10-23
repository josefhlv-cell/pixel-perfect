import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Zapomenuté heslo — Reality Investor" },
      { name: "description", content: "Obnovení hesla k účtu Reality Investor." },
      { property: "og:title", content: "Zapomenuté heslo — Reality Investor" },
      { property: "og:description", content: "Pošleme vám odkaz pro nastavení nového hesla." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Forgot,
});

function Forgot() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return void toast.error("Odkaz se nepodařilo odeslat. Chvíli počkejte a zkuste to znovu.");
    setSent(true);
  };
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold">Zapomenuté heslo</h1>
        {sent ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Pokud účet existuje, poslali jsme na {email} odkaz pro nastavení nového hesla.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button className="w-full" type="submit">
              Poslat odkaz
            </Button>
          </form>
        )}
        <Link to="/auth" className="mt-6 block text-sm text-primary hover:underline">
          Zpět na přihlášení
        </Link>
      </div>
    </div>
  );
}
