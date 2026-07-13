import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ClipboardList, Loader2, Plus, Search, Calendar, Hash, User, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";
import {
  STATUS_LABELS, STATUS_COLORS, STATUS_ORDER, type CommandeStatus,
} from "@/lib/commande-status";
import { setCommandeStatus } from "@/lib/commande-status-update";
import { ROLE_LABELS, type AppRole } from "@/hooks/use-auth";

type Row = {
  id: string;
  number: string;
  status: CommandeStatus;
  description: string | null;
  quantity: number;
  total_price: number | null;
  created_at: string;
  created_by: string | null;
  client_id: string;
  priority: "normal" | "urgent" | null;
  deadline: string | null;
  clients: { full_name: string; company_name: string | null; phone: string | null; phone2: string | null; address: string | null; city: string | null; client_type: string | null; brand_name: string | null; contact_origin: string | null; contact_origin_other: string | null } | null;
  order_types: { name: string } | null;
};

type Creator = { name: string; roles: AppRole[] };

export const Route = createFileRoute("/_authenticated/commandes/")({
  head: () => ({ meta: [{ title: "Commandes — ShapeAndPrint CRM" }] }),
  component: CommandesList,
});

const GROUP_ORDER: CommandeStatus[] = [
  "non_traite", "en_conception", "en_echantillonage", "confirme", "impression",
  "en_dtf", "en_production", "prete", "a_livrer", "livre_societe",
  "ramasse_livreur", "livre",
];

const GROUP_ACCENT: Record<CommandeStatus, { bar: string; dot: string; tint: string }> = {
  non_traite:      { bar: "bg-red-500",     dot: "bg-red-500",     tint: "from-red-500/10" },
  en_conception:   { bar: "bg-purple-500",  dot: "bg-purple-500",  tint: "from-purple-500/10" },
  en_echantillonage:{ bar: "bg-fuchsia-500", dot: "bg-fuchsia-500", tint: "from-fuchsia-500/10" },
  confirme:        { bar: "bg-teal-500",    dot: "bg-teal-500",    tint: "from-teal-500/10" },
  impression:      { bar: "bg-blue-500",    dot: "bg-blue-500",    tint: "from-blue-500/10" },
  en_dtf:          { bar: "bg-indigo-500",  dot: "bg-indigo-500",  tint: "from-indigo-500/10" },
  en_production:   { bar: "bg-sky-400",     dot: "bg-sky-400",     tint: "from-sky-400/10" },
  prete:           { bar: "bg-yellow-400",  dot: "bg-yellow-400",  tint: "from-yellow-400/10" },
  a_livrer:        { bar: "bg-zinc-400",    dot: "bg-zinc-400",    tint: "from-zinc-400/10" },
  livre_societe:   { bar: "bg-zinc-400",    dot: "bg-zinc-400",    tint: "from-zinc-400/10" },
  ramasse_livreur: { bar: "bg-zinc-300",    dot: "bg-zinc-300",    tint: "from-zinc-300/10" },
  livre:           { bar: "bg-emerald-500", dot: "bg-emerald-500", tint: "from-emerald-500/10" },
};

function CommandesList() {
  const { hasAnyRole, hasRole } = useAuth();
  const canCreate = hasAnyRole(["super_admin", "admin", "marketing", "design", "dtf"]);
  const isDtfOnly = hasRole("dtf") && !hasAnyRole(["super_admin", "admin", "marketing", "design", "production", "livraison"]);
  const canMarkPrete = hasAnyRole(["super_admin", "admin", "production"]);

  const markPrete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const { error } = await setCommandeStatus(id, "prete");
    if (error) { toast.error("Échec : " + error.message); return; }
    toast.success("Commande marquée Prête");
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: "prete" } : r)));
  };
  const [rows, setRows] = useState<Row[]>([]);
  const [creators, setCreators] = useState<Record<string, Creator>>({});
  const [lastModifiers, setLastModifiers] = useState<Record<string, { userId: string; at: string }>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("commandes")
      .select("id, number, status, description, quantity, total_price, created_at, created_by, client_id, priority, deadline, clients(full_name, company_name, phone, phone2, address, city, client_type, brand_name, contact_origin, contact_origin_other), order_types(name)")
      .order("created_at", { ascending: false });
    if (error) toast.error("Échec : " + error.message);
    const list = (data as unknown as Row[]) ?? [];
    setRows(list);

    // Last modification per commande from status_history
    const commandeIds = list.map((r) => r.id);
    const lastMap: Record<string, { userId: string; at: string }> = {};
    if (commandeIds.length) {
      const { data: hist } = await supabase
        .from("status_history")
        .select("commande_id, created_by, created_at")
        .in("commande_id", commandeIds)
        .order("created_at", { ascending: false });
      for (const h of (hist ?? []) as Array<{ commande_id: string; created_by: string | null; created_at: string }>) {
        if (!h.created_by) continue;
        if (!lastMap[h.commande_id]) lastMap[h.commande_id] = { userId: h.created_by, at: h.created_at };
      }
    }
    setLastModifiers(lastMap);

    const ids = Array.from(new Set([
      ...list.map((r) => r.created_by).filter((x): x is string => !!x),
      ...Object.values(lastMap).map((v) => v.userId),
    ]));
    if (ids.length) {
      const [{ data: profs }, { data: urs }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email").in("id", ids),
        supabase.from("user_roles").select("user_id, role").in("user_id", ids),
      ]);
      const map: Record<string, Creator> = {};
      for (const id of ids) map[id] = { name: "—", roles: [] };
      for (const p of (profs ?? []) as Array<{ id: string; full_name: string | null; email: string | null }>) {
        map[p.id] = { ...(map[p.id] ?? { roles: [] }), name: p.full_name || p.email?.split("@")[0] || "—" };
      }
      for (const r of (urs ?? []) as Array<{ user_id: string; role: AppRole }>) {
        (map[r.user_id] ??= { name: "—", roles: [] }).roles.push(r.role);
      }
      setCreators(map);
    } else {
      setCreators({});
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
    const ch = supabase
      .channel("commandes-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "commandes" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (isDtfOnly && !(r.order_types?.name ?? "").toLowerCase().includes("dtf")) return false;
      if (statusFilter === "all") {
        if (r.status === "livre") return false;
      } else if (statusFilter !== r.status) {
        return false;
      }
      if (dateFilter) {
        const d = new Date(r.created_at);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        if (`${y}-${m}-${day}` !== dateFilter) return false;
      }
      if (!q) return true;
      const creator = r.created_by ? creators[r.created_by] : undefined;
      return [
        r.number, r.description, r.clients?.full_name, r.clients?.company_name,
        r.order_types?.name, creator?.name,
        ...(creator?.roles.map((x) => ROLE_LABELS[x]) ?? []),
      ]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [rows, search, statusFilter, isDtfOnly, dateFilter, creators]);

  const grouped = useMemo(() => {
    const map = new Map<CommandeStatus, Row[]>();
    for (const r of filtered) {
      const arr = map.get(r.status) ?? [];
      arr.push(r);
      map.set(r.status, arr);
    }
    for (const [, arr] of map) {
      arr.sort((a, b) => {
        const ua = a.priority === "urgent" ? 0 : 1;
        const ub = b.priority === "urgent" ? 0 : 1;
        if (ua !== ub) return ua - ub;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
    return GROUP_ORDER.filter((s) => map.has(s)).map((s) => [s, map.get(s)!] as const);
  }, [filtered]);

  const totalActive = rows.filter((r) => r.status !== "livre").length;

  return (
    <div>
      <PageHeader
        eyebrow="Production"
        title="Commandes"
        description={`${totalActive} active${totalActive > 1 ? "s" : ""} · ${rows.length} au total`}
        helper="Toutes les commandes regroupées par statut. Les urgentes apparaissent en premier dans chaque groupe. Cliquez sur une carte pour ouvrir le détail."
        actions={canCreate && (
          <Button asChild className="shadow-[var(--shadow-glow)]">
            <Link to="/commandes/nouvelle"><Plus className="h-4 w-4 mr-2" />Nouvelle commande</Link>
          </Button>
        )}
      />

      <Card className="shadow-[var(--shadow-soft)] mb-6 border-border/60">
        <CardContent className="p-3 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par numéro, client ou type de commande…"
              className="pl-9 bg-background/60"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="relative sm:w-48">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="date"
              className="pl-9 bg-background/60"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>
          {dateFilter && (
            <Button variant="ghost" size="sm" onClick={() => setDateFilter("")}>Effacer date</Button>
          )}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="sm:w-64 bg-background/60"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les actives (sauf livrées)</SelectItem>
              {STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {loading ? (
        <div className="py-16 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="shadow-[var(--shadow-soft)] border-dashed">
          <CardContent className="py-16 text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
            <ClipboardList className="h-10 w-10 opacity-30" />
            <div className="font-medium text-foreground">Aucune commande</div>
            <p className="max-w-sm">
              {search || statusFilter !== "all"
                ? "Aucun résultat ne correspond à votre recherche. Essayez d'élargir les filtres."
                : "Aucune commande active pour le moment. Créez-en une pour démarrer."}
            </p>
            {canCreate && !search && statusFilter === "all" && (
              <Button asChild className="mt-2">
                <Link to="/commandes/nouvelle"><Plus className="h-4 w-4 mr-2" />Créer la première commande</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {grouped.map(([status, list]) => {
            const accent = GROUP_ACCENT[status];
            return (
              <section key={status} aria-labelledby={`grp-${status}`}>
                <div className="flex items-center gap-3 mb-3">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${accent.dot} shadow-[0_0_0_3px] shadow-background`} />
                  <h2 id={`grp-${status}`} className="font-display text-sm uppercase tracking-[0.16em] text-foreground">
                    {STATUS_LABELS[status]}
                  </h2>
                  <span className="font-mono text-xs text-muted-foreground">{list.length}</span>
                  <div className="flex-1 h-px bg-border/60" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {list.map((r) => (
                    <Link
                      key={r.id}
                      to="/commandes/$id"
                      params={{ id: r.id }}
                      className="group relative block focus:outline-none"
                    >
                      <Card
                        className={`relative h-full overflow-hidden border-border/60 bg-card/80 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)] hover:border-primary/40 ${r.priority === "urgent" ? "ring-1 ring-destructive/50" : ""}`}
                      >
                        <span className={`absolute left-0 top-0 h-full w-1 ${accent.bar}`} />
                        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent.tint} to-transparent opacity-60`} />

                        <CardContent className="relative p-4">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                              <Hash className="h-3 w-3" />
                              <span className="text-foreground font-medium">{r.number}</span>
                            </div>
                            {r.priority === "urgent" && (
                              <Badge variant="destructive" className="text-[10px] animate-pulse">URGENT</Badge>
                            )}
                          </div>

                          <div className="font-semibold text-sm truncate mb-0.5">
                            {r.clients?.full_name ?? "—"}
                            {r.clients?.brand_name ? ` (${r.clients.brand_name})` : ""}
                          </div>
                          {r.clients?.company_name && r.clients.company_name !== r.clients.brand_name && (
                            <div className="text-xs text-muted-foreground truncate mb-1">
                              {r.clients.company_name}
                            </div>
                          )}
                          {r.clients?.phone && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                              <Phone className="h-3 w-3 shrink-0" />
                              <span className="truncate">{r.clients.phone}{r.clients.phone2 ? ` · ${r.clients.phone2}` : ""}</span>
                            </div>
                          )}
                          {(r.clients?.address || r.clients?.city) && (
                            <div className="flex items-start gap-1 text-xs text-muted-foreground mb-1">
                              <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                              <span className="line-clamp-1">{[r.clients?.address, r.clients?.city].filter(Boolean).join(", ")}</span>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-1 mb-2">
                            {r.clients?.client_type && (
                              <Badge variant="outline" className="text-[10px] capitalize">{r.clients.client_type}</Badge>
                            )}
                            {r.clients?.contact_origin && (
                              <Badge variant="outline" className="text-[10px] capitalize">
                                Origine : {r.clients.contact_origin === "autre" ? (r.clients.contact_origin_other || "autre") : r.clients.contact_origin}
                              </Badge>
                            )}
                          </div>

                          <div className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
                            {r.description || "Sans description"}
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-1.5">
                            <Badge className={STATUS_COLORS[r.status]} variant="secondary">
                              {STATUS_LABELS[r.status]}
                            </Badge>
                            {r.order_types?.name && (
                              <Badge variant="outline" className="text-[10px] font-mono">
                                {r.order_types.name}
                              </Badge>
                            )}
                            {canMarkPrete && r.status !== "prete" && r.status !== "livre" && (
                              <Button
                                size="sm"
                                className="ml-auto h-7 px-2 text-[11px] bg-yellow-400 text-yellow-950 hover:bg-yellow-500"
                                onClick={(e) => void markPrete(e, r.id)}
                              >
                                Prêt
                              </Button>
                            )}
                          </div>

                          <div className="mt-3 flex items-end justify-between border-t border-border/60 pt-3">
                            <div className="text-[11px] text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(r.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </div>
                              <div className="font-mono mt-0.5">Qté {r.quantity}</div>
                            </div>
                            {r.total_price != null && (
                              <div className="text-right">
                                <div className="font-display text-base font-semibold text-foreground">
                                  {Number(r.total_price).toFixed(2)}
                                </div>
                                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">DT</div>
                              </div>
                            )}
                          </div>

                          {(() => {
                            const c = r.created_by ? creators[r.created_by] : undefined;
                            if (!c) return null;
                            return (
                              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <User className="h-3 w-3" />
                                <span className="text-foreground font-medium truncate">{c.name}</span>
                                {c.roles.length > 0 && (
                                  <span className="font-mono opacity-70 truncate">
                                    · {c.roles.map((rr) => ROLE_LABELS[rr]).join(", ")}
                                  </span>
                                )}
                              </div>
                            );
                          })()}

                          {(() => {
                            const lm = lastModifiers[r.id];
                            if (!lm) return null;
                            const u = creators[lm.userId];
                            if (!u) return null;
                            return (
                              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <span className="opacity-70">Dernière modification :</span>
                                <span className="text-foreground font-medium truncate">{u.name}</span>
                                {u.roles.length > 0 && (
                                  <span className="font-mono opacity-70 truncate">
                                    · {u.roles.map((rr) => ROLE_LABELS[rr]).join(", ")}
                                  </span>
                                )}
                              </div>
                            );
                          })()}

                          {r.priority === "urgent" && r.deadline && (
                            <div className="mt-2 rounded-md bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
                              Limite : {new Date(r.deadline).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
