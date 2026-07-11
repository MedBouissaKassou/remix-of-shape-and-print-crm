import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Download, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx-js-style";

export const Route = createFileRoute("/_authenticated/commandes/du-jour")({
  head: () => ({ meta: [{ title: "Commandes du jour — ShapeAndPrint CRM" }] }),
  component: CommandesDuJour,
});

type Row = {
  id: string;
  number: string;
  client_id: string;
  description: string | null;
  comment: string | null;
  total_price: number | null;
  tva_amount: number | null;
  created_at: string;
  clients: {
    full_name: string;
    address: string | null;
    city: string | null;
    governorate: string | null;
    phone: string | null;
    phone2: string | null;
  } | null;
};

type Grouped = {
  client_id: string;
  full_name: string;
  address: string;
  governorate: string;
  city: string;
  phone: string;
  phone2: string;
  count: number;
  totalTTC: number;
  designation: string;
  comment: string;
};

const FRAIS_LIVRAISON = 7;

function startOfTodayIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function CommandesDuJour() {
  const { hasAnyRole } = useAuth();
  const allowed = hasAnyRole(["super_admin", "admin", "marketing", "design", "livraison"]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    // Find commande IDs that transitioned to "livre_societe" today
    const { data: hist, error: histErr } = await supabase
      .from("status_history")
      .select("commande_id, created_at")
      .eq("to_status", "livre_societe" as any)
      .gte("created_at", startOfTodayIso());
    if (histErr) {
      toast.error("Échec : " + histErr.message);
      setRows([]);
      setLoading(false);
      return;
    }
    const ids = Array.from(new Set((hist ?? []).map((h: any) => h.commande_id)));
    if (ids.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from("commandes")
      .select("id, number, client_id, description, comment, total_price, tva_amount, created_at, status, clients(full_name, address, city, governorate, phone, phone2)")
      .in("id", ids)
      .eq("status", "livre_societe" as any)
      .order("created_at", { ascending: true });
    if (error) toast.error("Échec : " + error.message);
    setRows(((data as unknown) as Row[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (!allowed) return;
    void load();
    const ch = supabase
      .channel("cmd-du-jour")
      .on("postgres_changes", { event: "*", schema: "public", table: "commandes" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [allowed]);

  const grouped = useMemo<Grouped[]>(() => {
    const map = new Map<string, Grouped>();
    for (const r of rows) {
      const c = r.clients;
      const key = r.client_id;
      const ttc = Number(r.total_price ?? 0) + Number(r.tva_amount ?? 0);
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
        existing.totalTTC += ttc;
      } else {
        map.set(key, {
          client_id: key,
          full_name: c?.full_name ?? "",
          address: c?.address ?? "",
          governorate: c?.governorate ?? "",
          city: c?.city ?? "",
          phone: c?.phone ?? "",
          phone2: c?.phone2 ?? "",
          count: 1,
          totalTTC: ttc,
          designation: r.description ?? "",
          comment: r.comment ?? "",
        });
      }
    }
    return Array.from(map.values());
  }, [rows]);

  const exportXlsx = () => {
    const header = [
      "Nom client", "Adresse", "Gouvernorat", "Ville", "Téléphone", "Téléphone 2",
      "Nbr article", "Prix", "Désignation", "Commentaire", "Ouvrir colis", "Colis Fragile",
    ];
    const data: (string | number)[][] = [header];
    for (const g of grouped) {
      data.push([
        g.full_name, g.address, g.governorate, g.city, g.phone, g.phone2,
        g.count, Number((g.totalTTC + FRAIS_LIVRAISON).toFixed(3)),
        g.designation, g.comment, "OUI", "OUI",
      ]);
    }
    const ws = XLSX.utils.aoa_to_sheet(data);
    // Style header
    const headerStyle = {
      font: { bold: true, italic: true, underline: true, color: { rgb: "000000" } },
      alignment: { horizontal: "center", vertical: "center" },
    } as const;
    for (let c = 0; c < header.length; c++) {
      const ref = XLSX.utils.encode_cell({ r: 0, c });
      if (ws[ref]) (ws[ref] as any).s = headerStyle;
    }
    ws["!cols"] = [
      { wch: 22 }, { wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
      { wch: 10 }, { wch: 10 }, { wch: 24 }, { wch: 24 }, { wch: 12 }, { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Commandes du jour");
    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `commandes-du-jour-${today}.xlsx`);
  };

  if (!allowed) {
    return <div className="p-6 text-sm text-muted-foreground">Accès réservé.</div>;
  }

  return (
    <div>
      <PageHeader
        eyebrow="Logistique du jour"
        title="Commandes du jour"
        description={`Commandes à livrer avec société de livraison enregistrées aujourd'hui — ${grouped.length} client${grouped.length > 1 ? "s" : ""}`}
        helper="Liste consolidée par client des commandes à expédier aujourd'hui via une société de livraison. Exportez en Excel pour transmettre au transporteur."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCcw className="h-4 w-4 mr-2" />Actualiser
            </Button>
            <Button size="sm" onClick={exportXlsx} disabled={!grouped.length}>
              <Download className="h-4 w-4 mr-2" />Exporter Excel
            </Button>
          </div>
        }
      />

      <Card className="shadow-[var(--shadow-soft)]">
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : grouped.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Aucune commande du jour avec le statut « À livrer avec société de livraison ».
            </div>
          ) : (
            <table className="w-full text-xs min-w-[1100px]">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  {["Nom client", "Adresse", "Gouvernorat", "Ville", "Téléphone", "Téléphone 2", "Nbr article", "Prix", "Désignation", "Commentaire", "Ouvrir colis", "Colis Fragile"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap underline italic">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {grouped.map((g) => (
                  <tr key={g.client_id} className="hover:bg-accent/30">
                    <td className="px-3 py-2 whitespace-nowrap">{g.full_name}</td>
                    <td className="px-3 py-2">{g.address}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{g.governorate}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{g.city}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{g.phone}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{g.phone2}</td>
                    <td className="px-3 py-2 text-center">{g.count}</td>
                    <td className="px-3 py-2 text-right font-medium">{(g.totalTTC + FRAIS_LIVRAISON).toFixed(3)}</td>
                    <td className="px-3 py-2">{g.designation}</td>
                    <td className="px-3 py-2">{g.comment}</td>
                    <td className="px-3 py-2 text-center font-semibold text-emerald-700">OUI</td>
                    <td className="px-3 py-2 text-center font-semibold text-emerald-700">OUI</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}