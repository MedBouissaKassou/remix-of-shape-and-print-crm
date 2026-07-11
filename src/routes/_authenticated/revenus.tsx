import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, ROLE_LABELS, type AppRole } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/revenus")({
  head: () => ({ meta: [{ title: "Revenus libres — ShapeAndPrint CRM" }] }),
  component: RevenusPage,
});

type Row = {
  id: string;
  amount: number;
  label: string | null;
  received_at: string;
  created_at: string;
  created_by: string | null;
  department: AppRole | null;
};

const DEPT_BUCKETS: AppRole[] = ["admin", "design", "dtf"];

function pickDept(roles: AppRole[]): AppRole | null {
  if (roles.includes("super_admin")) return "admin";
  for (const r of DEPT_BUCKETS) if (roles.includes(r)) return r;
  return null;
}

function RevenusPage() {
  const { user, roles, hasAnyRole } = useAuth();
  const canEdit = hasAnyRole(["super_admin", "admin", "design", "dtf"]);
  const canDelete = hasAnyRole(["super_admin", "admin"]);
  const seeAll = hasAnyRole(["super_admin", "admin"]);
  const myDept = pickDept(roles);
  if (!hasAnyRole(["super_admin", "admin", "design", "dtf"])) {
    return <div className="p-6 text-sm text-muted-foreground">Accès réservé.</div>;
  }

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 16));
  const [saving, setSaving] = useState(false);
  const [filterDay, setFilterDay] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("incoming_funds")
      .select("*")
      .order("received_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const dayRows = useMemo(
    () => rows.filter((r) => {
      if (r.received_at.slice(0, 10) !== filterDay) return false;
      if (seeAll) return true;
      return (r.department ?? "admin") === myDept;
    }),
    [rows, filterDay, seeAll, myDept],
  );
  const totalsByDept = useMemo(() => {
    const acc: Record<AppRole, number> = { admin: 0, design: 0, dtf: 0 } as any;
    for (const r of dayRows) {
      const d = (r.department ?? "admin") as AppRole;
      if (d in acc) (acc as any)[d] += Number(r.amount ?? 0);
    }
    return acc;
  }, [dayRows]);
  const grandTotal = useMemo(
    () => DEPT_BUCKETS.reduce((s, d) => s + ((totalsByDept as any)[d] ?? 0), 0),
    [totalsByDept],
  );

  const add = async () => {
    const n = parseFloat(amount.replace(",", "."));
    if (Number.isNaN(n) || n <= 0) { toast.error("Montant invalide"); return; }
    const dept = pickDept(roles);
    setSaving(true);
    const { error } = await supabase.from("incoming_funds").insert({
      amount: n,
      label: label.trim() || null,
      received_at: new Date(date).toISOString(),
      created_by: user?.id ?? null,
      department: dept,
    } as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Revenu ajouté");
    setAmount(""); setLabel("");
    void load();
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer ce revenu ?")) return;
    const { error } = await supabase.from("incoming_funds").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setRows((p) => p.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Comptabilité"
        title="Revenus libres"
        description="Encaissements sans commande"
        helper="Enregistrez ici les recettes qui ne sont liées à aucune commande (vente directe, service rendu, remboursement…). Sélectionnez le département concerné pour les retrouver dans les analytics."
      />

      {canEdit && (
        <Card>
          <CardHeader><CardTitle className="text-base">Nouveau revenu</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-4 gap-3">
            <div>
              <Label>Montant (DT)</Label>
              <Input type="number" step="0.001" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Libellé</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex: Vente comptoir" />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="sm:col-span-4">
              <Button onClick={add} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                Ajouter
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-end gap-3 space-y-0 flex-wrap">
          <div>
            <Label className="text-xs">Jour</Label>
            <Input type="date" value={filterDay} onChange={(e) => setFilterDay(e.target.value)} className="w-44" />
          </div>
          <div className="ml-auto flex flex-wrap gap-3">
            {(seeAll ? DEPT_BUCKETS : (myDept ? [myDept] : [])).map((d) => (
              <div key={d} className="rounded-md border px-3 py-1.5 text-right">
                <div className="text-[10px] uppercase text-muted-foreground">{ROLE_LABELS[d]}</div>
                <div className="text-sm font-semibold tabular-nums">{((totalsByDept as any)[d] ?? 0).toFixed(3)} DT</div>
              </div>
            ))}
            {seeAll && (
              <div className="rounded-md bg-primary/10 px-3 py-1.5 text-right">
                <div className="text-[10px] uppercase text-primary">Total du jour</div>
                <div className="text-sm font-semibold tabular-nums">{grandTotal.toFixed(3)} DT</div>
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Entrées du {new Date(filterDay).toLocaleDateString("fr-FR")} ({dayRows.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
          ) : dayRows.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Aucun revenu</div>
          ) : (
            <div className="divide-y">
              {dayRows.map((r) => (
                <div key={r.id} className="p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{r.label || "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(r.received_at).toLocaleString("fr-FR")}
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px] uppercase">
                    {r.department ? ROLE_LABELS[r.department] : "—"}
                  </Badge>
                  <div className="text-sm font-semibold tabular-nums">{Number(r.amount).toFixed(3)} DT</div>
                  {canDelete && (
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => remove(r.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}