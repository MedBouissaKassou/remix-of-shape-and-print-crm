import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABELS, STATUS_ORDER, type CommandeStatus } from "@/lib/commande-status";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [{ title: "Analytics — ShapeAndPrint CRM" }] }),
  component: AnalyticsPage,
});

const COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(262, 83%, 58%)",
  "hsl(38, 92%, 50%)",
  "hsl(24, 95%, 53%)",
  "hsl(189, 94%, 43%)",
  "hsl(160, 84%, 39%)",
  "hsl(0, 0%, 60%)",
];

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      const since = new Date();
      since.setMonth(since.getMonth() - 5);
      since.setDate(1);
      since.setHours(0, 0, 0, 0);

      const [{ data: cmds }, { data: facs }, { data: clients }] = await Promise.all([
        supabase.from("commandes").select("id, status, total_price, created_at, client_id, order_type_id"),
        supabase.from("factures").select("id, total_ttc, paid, created_at").gte("created_at", since.toISOString()),
        supabase.from("clients").select("id, full_name, company_name"),
      ]);

      // Statuts
      const statusCounts: Record<string, number> = {};
      STATUS_ORDER.forEach((s) => (statusCounts[s] = 0));
      (cmds ?? []).forEach((c) => {
        statusCounts[c.status as CommandeStatus] = (statusCounts[c.status as CommandeStatus] ?? 0) + 1;
      });
      const statusData = STATUS_ORDER.map((s) => ({ name: STATUS_LABELS[s], value: statusCounts[s] }));

      // CA mensuel (factures)
      const months: { key: string; label: string }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - i);
        months.push({
          key: monthKey(d),
          label: d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" }),
        });
      }
      const revenueByMonth: Record<string, { ca: number; paye: number }> = {};
      months.forEach((m) => (revenueByMonth[m.key] = { ca: 0, paye: 0 }));
      (facs ?? []).forEach((f) => {
        const k = monthKey(new Date(f.created_at as string));
        if (revenueByMonth[k]) {
          const v = Number(f.total_ttc) || 0;
          revenueByMonth[k].ca += v;
          if (f.paid) revenueByMonth[k].paye += v;
        }
      });
      const revenueData = months.map((m) => ({
        month: m.label,
        "CA": Math.round(revenueByMonth[m.key].ca),
        "Encaissé": Math.round(revenueByMonth[m.key].paye),
      }));

      // Top clients par nb de commandes
      const byClient: Record<string, { count: number; total: number }> = {};
      (cmds ?? []).forEach((c) => {
        const id = c.client_id as string;
        if (!byClient[id]) byClient[id] = { count: 0, total: 0 };
        byClient[id].count += 1;
        byClient[id].total += Number(c.total_price) || 0;
      });
      const clientName = new Map(
        (clients ?? []).map((c) => [c.id, c.company_name || c.full_name]),
      );
      const topClients = Object.entries(byClient)
        .map(([id, v]) => ({ name: clientName.get(id) ?? "—", commandes: v.count, ca: Math.round(v.total) }))
        .sort((a, b) => b.commandes - a.commandes)
        .slice(0, 5);

      const totalCmds = cmds?.length ?? 0;
      const livrees = statusCounts.livre ?? 0;
      const totalCA = (facs ?? []).reduce((s, f) => s + (Number(f.total_ttc) || 0), 0);
      const enAttente = (facs ?? []).filter((f) => !f.paid).reduce((s, f) => s + (Number(f.total_ttc) || 0), 0);

      return { statusData, revenueData, topClients, kpis: { totalCmds, livrees, totalCA, enAttente } };
    },
  });

  const fmt = (n: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "TND", maximumFractionDigits: 0 }).format(n);

  return (
    <div>
      <PageHeader
        eyebrow="Pilotage"
        title="Analytics"
        description="Vue d'ensemble de l'activité"
        helper="Indicateurs clés sur les commandes, le chiffre d'affaires, les départements et l'évolution dans le temps. Utilisez les filtres pour affiner la période analysée."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        {[
          { label: "Commandes totales", value: data?.kpis.totalCmds ?? "—" },
          { label: "Commandes livrées", value: data?.kpis.livrees ?? "—" },
          { label: "CA (6 mois)", value: data ? fmt(data.kpis.totalCA) : "—" },
          { label: "Factures en attente", value: data ? fmt(data.kpis.enAttente) : "—" },
        ].map((k) => (
          <Card key={k.label} className="shadow-[var(--shadow-soft)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{k.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="shadow-[var(--shadow-soft)]">
          <CardHeader><CardTitle className="text-base">Chiffre d'affaires (6 derniers mois)</CardTitle></CardHeader>
          <CardContent className="h-72">
            {isLoading ? null : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.revenueData ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="CA" stroke={COLORS[0]} strokeWidth={2} />
                  <Line type="monotone" dataKey="Encaissé" stroke={COLORS[5]} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-soft)]">
          <CardHeader><CardTitle className="text-base">Commandes par statut</CardTitle></CardHeader>
          <CardContent className="h-72">
            {isLoading ? null : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data?.statusData ?? []} dataKey="value" nameKey="name" outerRadius={90} label>
                    {(data?.statusData ?? []).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-soft)] lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Top 5 clients (par nombre de commandes)</CardTitle></CardHeader>
          <CardContent className="h-72">
            {isLoading ? null : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.topClients ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="commandes" fill={COLORS[1]} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}