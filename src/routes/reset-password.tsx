import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nové heslo — Reality Investor" },
      { name: "description", content: "Nastavte si nové heslo." },
      { property: "og:title", content: "Nové heslo — Reality Investor" },
      { property: "og:description", content: "Nastavení nového hesla k účtu." },
    ],
  }),
  component: Reset,
});

function Reset() {
  const [pw, setPw] = useState("");
  const navigate = useNavigate();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 8) return void toast.error("Heslo musí mít alespoň 8 znaků");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return void toast.error(error.message);
    toast.success("Heslo změněno");
    navigate({ to: "/dashboard" });
  };
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Nové heslo</h1>
        <div className="space-y-1.5">
          <Label htmlFor="pw">Nové heslo</Label>
          <Input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
        </div>
        <Button className="w-full" type="submit">Uložit heslo</Button>
      </form>
    </div>
  );
}
