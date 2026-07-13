import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ClipboardList, Truck, Receipt, AlertTriangle } from "lucide-react";
import { useAuth, ROLE_LABELS } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/tableau-de-bord")({
  head: () => ({ meta: [{ title: "Tableau de bord — ShapeAndPrint CRM" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user, roles } = useAuth();
  const { data: counts } = useQuery({
    queryKey: ["dashboard-counts"],
    queryFn: async () => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const [clients, enCours, aLivrer, factures] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("commandes").select("id", { count: "exact", head: true }).neq("status", "livre"),
        supabase.from("commandes").select("id", { count: "exact", head: true }).in("status", ["a_livrer", "ramasse_livreur"]),
        supabase.from("factures").select("id", { count: "exact", head: true }).gte("created_at", startOfMonth.toISOString()),
      ]);
      return {
        clients: clients.count ?? 0,
        enCours: enCours.count ?? 0,
        aLivrer: aLivrer.count ?? 0,
        factures: factures.count ?? 0,
      };
    },
  });

  const { data: urgents } = useQuery({
    queryKey: ["dashboard-urgents"],
    queryFn: async () => {
      const { data } = await supabase
        .from("commandes")
        .select("id, number, deadline, status, clients(full_name)")
        .eq("priority", "urgent")
        .neq("status", "livre")
        .order("deadline", { ascending: true, nullsFirst: false });
      return (data ?? []) as Array<{ id: string; number: string; deadline: string | null; status: string; clients: { full_name: string } | null }>;
    },
    refetchInterval: 60_000,
  });
  const stats: { label: string; value: number | string; icon: typeof Users; hint: string; to: string }[] = [
    { label: "Clients", value: counts?.clients ?? "—", icon: Users, hint: "Total", to: "/clients" },
    { label: "Commandes en cours", value: counts?.enCours ?? "—", icon: ClipboardList, hint: "Hors livrées", to: "/commandes" },
    { label: "À livrer", value: counts?.aLivrer ?? "—", icon: Truck, hint: "À livrer / ramassées", to: "/livraison" },
    { label: "Factures du mois", value: counts?.factures ?? "—", icon: Receipt, hint: "Émises ce mois", to: "/factures" },
  ];
  return (
    <div>
      <PageHeader
        eyebrow="Vue d'ensemble"
        title={`Bonjour ${(user?.user_metadata?.full_name as string)?.split(" ")[0] ?? ""}`}
        description="Activité du jour, indicateurs clés et commandes à surveiller."
        helper="Cliquez sur une carte pour ouvrir la section correspondante. Les commandes urgentes sont mises en évidence ci-dessous."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            to={s.to}
            className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
          >
            <Card className="shadow-[var(--shadow-soft)] transition-all hover:shadow-md hover:-translate-y-0.5 cursor-pointer h-full">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
                <s.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{s.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{s.hint}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {urgents && urgents.length > 0 && (
        <Card className="mt-6 shadow-[var(--shadow-soft)] border-red-500/40 bg-red-50/30 dark:bg-red-900/10">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertTriangle className="h-4 w-4 animate-pulse" />
              Commandes urgentes ({urgents.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {urgents.map((u) => (
              <Link
                key={u.id}
                to="/commandes/$id"
                params={{ id: u.id }}
                className="flex items-center justify-between gap-3 py-2 hover:bg-red-100/40 dark:hover:bg-red-900/20 -mx-2 px-2 rounded transition-colors"
              >
                <div className="min-w-0">
                  <div className="font-semibold flex items-center gap-2">
                    {u.number}
                    <Badge variant="destructive" className="text-[10px]">URGENT</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{u.clients?.full_name ?? "—"}</div>
                </div>
                <div className="text-xs text-red-700 dark:text-red-300 text-right shrink-0">
                  {u.deadline ? new Date(u.deadline).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "Sans date"}
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="mt-6 shadow-[var(--shadow-soft)]">
        <CardHeader><CardTitle className="text-base">Bienvenue dans ShapeAndPrint CRM</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Vos rôles actuels : <span className="text-foreground font-medium">{roles.length ? roles.map((r) => ROLE_LABELS[r]).join(", ") : "Aucun rôle assigné"}</span></p>
          {!roles.length && (
            <p className="text-warning">Contactez un Super Admin pour vous attribuer un rôle et débloquer les sections du CRM.</p>
          )}
          <p>Les sections Clients, Commandes, Documents et Analytics seront livrées dans les prochaines phases.</p>
        </CardContent>
      </Card>
    </div>
  );
}