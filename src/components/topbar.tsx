import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Bell, Moon, Sun, LogOut, Search } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "@tanstack/react-router";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Notif = { id: string; title: string; body: string | null; link: string | null; read: boolean; created_at: string };

export function Topbar() {
  const { theme, toggle } = useTheme();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState<Notif[]>([]);

  const loadNotifs = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("notifications").select("*").eq("user_id", user.id)
      .order("created_at", { ascending: false }).limit(20);
    setNotifs((data as Notif[]) ?? []);
  };

  useEffect(() => {
    if (!user?.id) return;
    void loadNotifs();
    const ch = supabase
      .channel("notifs-" + user.id)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as Notif;
          setNotifs((prev) => [n, ...prev]);
          toast(n.title, {
            description: n.body ?? undefined,
            duration: 8000,
            action: n.link
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ? { label: "Ouvrir", onClick: () => navigate({ to: n.link as any }) }
              : undefined,
          });
        })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [user?.id]);

  const unread = notifs.filter((n) => !n.read).length;

  const markAllRead = async () => {
    if (!user?.id || unread === 0) return;
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const initials = (user?.user_metadata?.full_name as string | undefined)
    ?.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase()
    ?? user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <header className="h-14 sticky top-0 z-30 flex items-center gap-2 border-b bg-background/80 backdrop-blur px-3 md:px-4">
      <SidebarTrigger />
      <div className="hidden md:flex items-center gap-2 flex-1 max-w-md ml-2">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher clients, commandes..." className="pl-9 h-9 bg-muted/50 border-0" />
        </div>
      </div>
      <div className="flex-1 md:hidden" />
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Changer de thème">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <DropdownMenu onOpenChange={(o) => { if (!o) void markAllRead(); }}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
              <Bell className="h-4 w-4" />
              {unread > 0 && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notifications {unread > 0 && <span className="text-xs text-muted-foreground">({unread} non lues)</span>}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {notifs.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Aucune notification</div>
            ) : (
              <div className="max-h-80 overflow-auto">
                {notifs.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onClick={() => { if (n.link) navigate({ to: n.link as any }); }}
                    className={`w-full text-left px-3 py-2 hover:bg-accent text-sm border-b last:border-0 ${n.read ? "opacity-70" : "font-medium"}`}
                  >
                    <div>{n.title}</div>
                    {n.body && <div className="text-xs text-muted-foreground font-normal">{n.body}</div>}
                    <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(n.created_at).toLocaleString("fr-FR")}</div>
                  </button>
                ))}
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-xs bg-[var(--gradient-primary)] text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-sm">{(user?.user_metadata?.full_name as string) ?? "Utilisateur"}</span>
              <span className="text-xs text-muted-foreground font-normal">{user?.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={async () => { await signOut(); navigate({ to: "/login", replace: true }); }}>
              <LogOut className="mr-2 h-4 w-4" /> Se déconnecter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}