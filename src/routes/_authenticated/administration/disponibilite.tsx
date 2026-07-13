import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth, ROLE_LABELS, type AppRole } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Loader2, LogIn, LogOut } from "lucide-react";
import { subscribeToPresence, type PresenceEntry } from "@/hooks/use-presence";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/administration/disponibilite")({
  ssr: false,
  head: () => ({ meta: [{ title: "Disponibilité — ShapeAndPrint CRM" }] }),
  component: AvailabilityPage,
});

const DEPARTMENTS: AppRole[] = [
  "super_admin",
  "admin",
  "marketing",
  "design",
  "production",
  "dtf",
  "livraison",
];

type ConnectionStats = { first: string | null; last: string | null };

function formatTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatRelative(iso: string | null) {
  if (!iso) return "";
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0) return "à l'instant";
  const totalMin = Math.floor(diffMs / 60000);
  if (totalMin < 1) return "il y a quelques secondes";
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `il y a ${days}j ${hours}h`;
  if (hours > 0) return `il y a ${hours}h ${mins}m`;
  return `il y a ${mins}m`;
}

function AvailabilityPage() {
  const { hasRole, loading } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<PresenceEntry[]>([]);
  const [statsByUser, setStatsByUser] = useState<Record<string, ConnectionStats>>({});
  const [rolesByUser, setRolesByUser] = useState<Record<string, AppRole[]>>({});
  const entriesRef = useRef<PresenceEntry[]>([]);
  entriesRef.current = entries;
  const entriesKey = useMemo(
    () => entries.map((e) => `${e.user_id}:${e.online_at}`).sort().join("|"),
    [entries],
  );

  useEffect(() => {
    if (loading) return;
    if (!hasRole("super_admin")) {
      navigate({ to: "/", replace: true });
      return;
    }
    const unsubscribe = subscribeToPresence(setEntries);
    return unsubscribe;
  }, [loading, hasRole, navigate]);

  // Load today's first connection per user + last connection ever, plus user roles
  useEffect(() => {
    if (loading || !hasRole("super_admin")) return;

    const load = async () => {
      // Persist what we currently observe via Realtime so first/last
      // connection times survive a department's disconnection.
      const observed = entriesRef.current;
      if (observed.length > 0) {
        await Promise.all(
          observed.map((e) =>
            supabase.rpc("record_observed_presence", {
              _user_id: e.user_id,
              _online_at: e.online_at,
            }),
          ),
        );
      }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);


      const [todayRes, lastRes, rolesRes] = await Promise.all([
        supabase
          .from("user_connections")
          .select("user_id, connected_at")
          .gte("connected_at", todayStart.toISOString())
          .order("connected_at", { ascending: true }),
        supabase
          .from("user_connections")
          .select("user_id, last_seen_at")
          .order("last_seen_at", { ascending: false })
          .limit(500),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      const stats: Record<string, ConnectionStats> = {};
      for (const row of (todayRes.data ?? []) as Array<{ user_id: string; connected_at: string }>) {
        if (!stats[row.user_id]) stats[row.user_id] = { first: row.connected_at, last: null };
      }
      for (const row of (lastRes.data ?? []) as Array<{ user_id: string; last_seen_at: string }>) {
        if (!stats[row.user_id]) stats[row.user_id] = { first: null, last: row.last_seen_at };
        else if (!stats[row.user_id].last) stats[row.user_id].last = row.last_seen_at;
      }
      setStatsByUser(stats);

      const r: Record<string, AppRole[]> = {};
      for (const row of (rolesRes.data ?? []) as Array<{ user_id: string; role: AppRole }>) {
        (r[row.user_id] ??= []).push(row.role);
      }
      setRolesByUser(r);
    };
    void load();
    const refreshId = setInterval(() => void load(), 30_000);
    return () => clearInterval(refreshId);
  }, [loading, hasRole, entriesKey]);

  const byDepartment = useMemo(() => {
    const map: Record<AppRole, PresenceEntry[]> = {
      super_admin: [], admin: [], marketing: [], design: [],
      production: [], dtf: [], livraison: [],
    };
    const seen = new Map<string, PresenceEntry>();
    for (const e of entries) {
      const prev = seen.get(e.user_id);
      if (!prev || new Date(e.online_at) > new Date(prev.online_at)) {
        seen.set(e.user_id, e);
      }
    }
    for (const e of seen.values()) {
      if (!e.roles || e.roles.length === 0) continue;
      for (const r of e.roles) {
        if (map[r]) map[r].push(e);
      }
    }
    return map;
  }, [entries]);

  // Aggregate first/last connection per department
  const deptStats = useMemo(() => {
    const result: Record<AppRole, { first: string | null; last: string | null }> = {
      super_admin: { first: null, last: null }, admin: { first: null, last: null },
      marketing: { first: null, last: null }, design: { first: null, last: null },
      production: { first: null, last: null }, dtf: { first: null, last: null },
      livraison: { first: null, last: null },
    };
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();

    for (const [userId, stats] of Object.entries(statsByUser)) {
      const userRoles = rolesByUser[userId] ?? [];
      for (const role of userRoles) {
        if (!result[role]) continue;
        if (stats.first && (!result[role].first || stats.first < result[role].first!)) {
          result[role].first = stats.first;
        }
        if (stats.last && (!result[role].last || stats.last > result[role].last!)) {
          result[role].last = stats.last;
        }
      }
    }
    // Fallback: use realtime presence online_at for currently online users
    // (covers first-connection-of-the-day before the DB row is observed)
    for (const role of DEPARTMENTS) {
      for (const u of byDepartment[role] ?? []) {
        if (u.online_at >= todayIso) {
          if (!result[role].first || u.online_at < result[role].first!) {
            result[role].first = u.online_at;
          }
        }
        if (!result[role].last || u.online_at > result[role].last!) {
          result[role].last = u.online_at;
        }
      }
    }
    return result;
  }, [statsByUser, rolesByUser, byDepartment]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Disponibilité des départements"
        description="Qui est actuellement connecté à la plateforme"
        helper="Mise à jour en temps réel via la présence Realtime. Un département est marqué « actif » dès qu'au moins un de ses membres est connecté."
      />

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {DEPARTMENTS.map((role) => {
          const users = byDepartment[role];
          const active = users.length > 0;
          const stats = deptStats[role];
          return (
            <Card key={role} className="shadow-[var(--shadow-soft)]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-full ${
                      active ? "bg-emerald-500 shadow-[0_0_0_3px] shadow-emerald-500/20 animate-pulse" : "bg-muted-foreground/30"
                    }`}
                  />
                  {ROLE_LABELS[role]}
                </CardTitle>
                <Badge variant={active ? "default" : "outline"} className={active ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" : ""}>
                  {active ? "Actif" : "Inactif"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground border-b border-border/40 pb-2">
                  {stats.first && (
                    <span className="inline-flex items-center gap-1">
                      <LogIn className="h-3 w-3 text-emerald-600" />
                      1ère connexion aujourd'hui : <span className="font-mono text-foreground">{formatTime(stats.first)}</span>
                    </span>
                  )}
                  {!active && stats.last && (
                    <span className="inline-flex items-center gap-1">
                      <LogOut className="h-3 w-3 text-muted-foreground" />
                      Dernière connexion : <span className="font-mono text-foreground">{new Date(stats.last).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      <span className="text-muted-foreground/80">({formatRelative(stats.last)})</span>
                    </span>
                  )}
                  {!stats.first && !stats.last && (
                    <span>Aucune connexion enregistrée</span>
                  )}
                </div>
                {users.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-3 text-center">Personne en ligne</div>
                ) : (
                  <ul className="space-y-2">
                    {users.map((u) => (
                      <li key={u.user_id} className="flex items-center justify-between text-sm">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{u.full_name}</div>
                          {u.email && <div className="text-xs text-muted-foreground truncate">{u.email}</div>}
                        </div>
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
                          <Activity className="h-3 w-3" /> en ligne
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
