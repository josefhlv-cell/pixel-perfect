import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard, Crosshair, Building2, Briefcase, Star, Calculator, LineChart, Bell, Sparkles, Settings, Map as MapIcon,
  Moon, Sun, LogOut, MoreHorizontal, User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { alertsQuery, profileQuery } from "@/lib/queries";
import { getTheme, setTheme } from "@/lib/theme";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export const NAV = [
  { to: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
  { to: "/deals", label: t("nav.dealHunter"), icon: Crosshair },
  { to: "/properties", label: t("nav.properties"), icon: Building2 },
  { to: "/portfolio", label: t("nav.portfolio"), icon: Briefcase },
  { to: "/watchlist", label: t("nav.watchlist"), icon: Star },
  { to: "/calculator", label: t("nav.calculator"), icon: Calculator },
  { to: "/market", label: t("nav.market"), icon: LineChart },
  { to: "/map", label: "Mapa", icon: MapIcon },
  { to: "/alerts", label: t("nav.alerts"), icon: Bell },
  { to: "/ai", label: t("nav.aiAnalyst"), icon: Sparkles },
  { to: "/settings", label: t("nav.settings"), icon: Settings },
] as const;

const MOBILE = ["/dashboard", "/deals", "/portfolio", "/watchlist"];

export function AppShell({ children }: { children: ReactNode }) {
  const [more, setMore] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r bg-sidebar lg:flex">
        <Link to="/dashboard" className="flex h-14 items-center gap-2 border-b px-4">
          <span className="grid h-7 w-7 place-items-center rounded bg-primary font-mono text-xs font-bold text-primary-foreground">RI</span>
          <span className="text-sm font-semibold tracking-tight">Reality Investor</span>
        </Link>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="flex items-center gap-2.5 rounded px-2.5 py-2 text-sm text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              activeProps={{ className: "bg-sidebar-accent !text-sidebar-accent-foreground font-medium" }}
            >
              <n.icon className="h-4 w-4" />
              {n.label}
            </Link>
          ))}
        </nav>
        <p className="border-t p-3 text-[10px] leading-snug text-muted-foreground">Nejde o investiční poradenství.</p>
      </aside>

      <div className="lg:pl-56">
        <TopBar />
        <main className="mx-auto max-w-7xl px-3 pb-24 pt-4 sm:px-6 lg:pb-10">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV.filter((n) => MOBILE.includes(n.to)).map((n) => (
          <Link key={n.to} to={n.to} className="flex flex-col items-center gap-0.5 py-2 text-[10px] text-muted-foreground" activeProps={{ className: "!text-primary" }}>
            <n.icon className="h-5 w-5" />
            {n.label}
          </Link>
        ))}
        <button onClick={() => setMore(true)} className="flex flex-col items-center gap-0.5 py-2 text-[10px] text-muted-foreground">
          <MoreHorizontal className="h-5 w-5" />
          Více
        </button>
      </nav>
      <Sheet open={more} onOpenChange={setMore}>
        <SheetContent side="bottom" className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <SheetHeader><SheetTitle>Více</SheetTitle></SheetHeader>
          <div className="grid grid-cols-3 gap-2 p-2">
            {NAV.filter((n) => !MOBILE.includes(n.to)).map((n) => (
              <Link key={n.to} to={n.to} onClick={() => setMore(false)} className="flex flex-col items-center gap-1 rounded-md border p-3 text-xs">
                <n.icon className="h-5 w-5 text-primary" />
                {n.label}
              </Link>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function TopBar() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: alerts } = useQuery(alertsQuery);
  const { data: profile } = useQuery(profileQuery);
  const unread = alerts?.filter((a) => !a.read_at) ?? [];
  const [theme, setT] = useState<"dark" | "light" | null>(null);

  const toggle = () => {
    const next = (theme ?? getTheme()) === "dark" ? "light" : "dark";
    setTheme(next);
    setT(next);
  };
  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur sm:px-6">
      <Link to="/dashboard" className="flex items-center gap-2 lg:hidden">
        <span className="grid h-7 w-7 place-items-center rounded bg-primary font-mono text-xs font-bold text-primary-foreground">RI</span>
      </Link>
      <div className="flex-1" />
      <Button variant="ghost" size="icon" onClick={toggle} aria-label="Přepnout motiv">
        <Sun className="hidden h-4 w-4 dark:block" />
        <Moon className="h-4 w-4 dark:hidden" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Notifikace" className="relative">
            <Bell className="h-4 w-4" />
            {unread.length > 0 && <span className="num absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] text-primary-foreground">{unread.length}</span>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Notifikace</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {unread.length === 0 && <div className="px-2 py-3 text-xs text-muted-foreground">Žádné nové notifikace.</div>}
          {unread.slice(0, 5).map((a) => (
            <DropdownMenuItem key={a.id} onClick={() => navigate({ to: "/alerts" })} className="flex-col items-start">
              <span className="text-sm">{a.title}</span>
              {a.body && <span className="line-clamp-1 text-xs text-muted-foreground">{a.body}</span>}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate({ to: "/alerts" })}>Otevřít Alert Center</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Uživatelské menu"><User className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="truncate text-sm">{profile?.profile?.display_name || profile?.email}</div>
            <div className="text-xs text-muted-foreground">Plán: {profile?.profile?.plan ?? "FREE"}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}><Settings className="mr-2 h-4 w-4" />Nastavení</DropdownMenuItem>
          <DropdownMenuItem onClick={signOut}><LogOut className="mr-2 h-4 w-4" />{t("common.signOut")}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

