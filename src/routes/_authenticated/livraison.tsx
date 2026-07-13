import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, Package, Phone, Truck } from "lucide-react";
import { toast } from "sonner";
import { STATUS_COLORS, STATUS_LABELS, type CommandeStatus } from "@/lib/commande-status";
import { setCommandeStatus } from "@/lib/commande-status-update";

export const Route = createFileRoute("/_authenticated/livraison")({
  head: () => ({ meta: [{ title: "Livraison — ShapeAndPrint CRM" }] }),
  component: LivraisonPage,
});

type Row = {
  id: string; number: string; status: CommandeStatus; total_price: number | null;
  clients: { full_name: string; phone: string | null; address: string | null; city: string | null } | null;
};

function LivraisonPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("commandes")
      .select("id, number, status, total_price, clients(full_name, phone, address, city)")
      .in("status", ["a_livrer", "ramasse_livreur"])
      .order("created_at");
    setRows((data as unknown as Row[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    const ch = supabase.channel("livraison")
      .on("postgres_changes", { event: "*", schema: "public", table: "commandes" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  const setStatus = async (id: string, status: CommandeStatus) => {
    const { error } = await setCommandeStatus(id, status);
    if (error) toast.error(error.message);
    else toast.success(STATUS_LABELS[status]);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Logistique"
        title="Livraison"
        description="Commandes à ramasser et à livrer"
        helper="Les commandes prêtes à partir, en cours de ramassage et celles à confier à une société de livraison. Mettez à jour le statut au fur et à mesure pour suivre l'avancement."
      />

      {loading ? (
        <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <Card className="shadow-[var(--shadow-soft)]">
          <CardContent className="py-16 flex flex-col items-center gap-3 text-muted-foreground">
            <Truck className="h-10 w-10 opacity-30" />
            Aucune commande à livrer
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => (
            <Card key={r.id} className="shadow-[var(--shadow-soft)]">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{r.number}</span>
                      <Badge className={STATUS_COLORS[r.status]} variant="secondary">{STATUS_LABELS[r.status]}</Badge>
                    </div>
                    <div className="font-medium">{r.clients?.full_name}</div>
                  </div>
                  {r.total_price != null && <div className="text-sm font-semibold">{Number(r.total_price).toFixed(2)} DT</div>}
                </div>

                {r.clients?.phone && (
                  <a href={`tel:${r.clients.phone}`} className="flex items-center gap-2 text-sm text-primary">
                    <Phone className="h-4 w-4" />{r.clients.phone}
                  </a>
                )}
                {(r.clients?.address || r.clients?.city) && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{[r.clients?.address, r.clients?.city].filter(Boolean).join(", ")}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-2">
                  {r.status === "a_livrer" ? (
                    <Button size="lg" className="col-span-2" onClick={() => setStatus(r.id, "ramasse_livreur")}>
                      Ramassé par moi
                    </Button>
                  ) : (
                    <>
                      <Button size="lg" variant="outline" onClick={() => setStatus(r.id, "a_livrer")}>Annuler</Button>
                      <Button size="lg" onClick={() => setStatus(r.id, "livre")}>Livré ✓</Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
