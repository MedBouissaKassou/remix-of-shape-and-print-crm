import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Download, Eye, FileText, Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

type DocKind = "devis" | "bl" | "facture";
const TABLE: Record<DocKind, "devis" | "bons_livraison" | "factures"> = {
  devis: "devis", bl: "bons_livraison", facture: "factures",
};

const META: Record<DocKind, { eyebrow: string; helper: string; empty: string }> = {
  devis: {
    eyebrow: "Documents commerciaux",
    helper: "Tous les devis générés. Les devis sont des propositions tarifaires avant commande — cliquez sur l'icône télécharger pour récupérer le PDF.",
    empty: "Aucun devis pour le moment. Créez-en un depuis une commande ou via Création Devis.",
  },
  bl: {
    eyebrow: "Documents de livraison",
    helper: "Bons de livraison émis. Ils accompagnent la marchandise lors de l'expédition au client.",
    empty: "Aucun bon de livraison pour le moment.",
  },
  facture: {
    eyebrow: "Documents comptables",
    helper: "Factures émises aux clients. Cliquez sur télécharger pour récupérer le PDF officiel.",
    empty: "Aucune facture pour le moment.",
  },
};

type Row = {
  id: string; number: string; created_at: string; storage_path: string;
  total_ttc?: number | null; commande_id: string | null;
  clients: { id: string; full_name: string; company_name: string | null } | null;
  commandes: { number: string } | null;
};

export function DocumentsList({ kind, title }: { kind: DocKind; title: string }) {
  const { hasAnyRole } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const canDelete = hasAnyRole(["super_admin", "marketing"]);
  const meta = META[kind];

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from(TABLE[kind] as any)
      .select("id, number, created_at, storage_path, total_ttc, commande_id, clients(id, full_name, company_name), commandes(number)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    setRows(((data as unknown) as Row[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [kind]);

  const view = async (r: Row) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(r.storage_path, 60);
    if (error || !data) { toast.error("Lien indisponible"); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const download = async (r: Row) => {
    const filename = `${r.number}.pdf`;
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(r.storage_path, 60, { download: filename });
    if (error || !data) { toast.error("Lien indisponible"); return; }
    // Use an anchor click so the browser honors the Content-Disposition header
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const deleteDocument = async (r: Row) => {
    if (r.storage_path && r.storage_path !== "pending") {
      await supabase.storage.from("documents").remove([r.storage_path]);
    }
    const { error } = await supabase.from(TABLE[kind] as any).delete().eq("id", r.id);
    if (error) { toast.error("Échec : " + error.message); return; }
    toast.success("Document supprimé");
    void load();
  };

  const filtered = rows.filter((r) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return r.number.toLowerCase().includes(s)
      || r.clients?.full_name?.toLowerCase().includes(s)
      || r.clients?.company_name?.toLowerCase().includes(s)
      || r.commandes?.number?.toLowerCase().includes(s);
  });

  return (
    <div>
      <PageHeader
        eyebrow={meta.eyebrow}
        title={title}
        description={`${rows.length} document${rows.length > 1 ? "s" : ""}`}
        helper={meta.helper}
      />
      <Card className="shadow-[var(--shadow-soft)] mb-4 border-border/60">
        <CardContent className="p-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 bg-background/60"
              placeholder="Rechercher par numéro, client ou commande…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-[var(--shadow-soft)] border-border/60">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
              <FileText className="h-10 w-10 opacity-30" />
              <div className="font-medium text-foreground">Aucun document</div>
              <p className="max-w-sm">{q ? "Aucun résultat pour cette recherche." : meta.empty}</p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {filtered.map((r) => (
                <div key={r.id} className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors">
                  <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium font-mono">{r.number}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {r.clients ? (
                        <Link to="/clients/$clientId" params={{ clientId: r.clients.id }} className="hover:text-primary hover:underline">
                          {r.clients.full_name}{r.clients.company_name ? ` · ${r.clients.company_name}` : ""}
                        </Link>
                      ) : "—"}
                      {r.commandes?.number ? ` · Cmd ${r.commandes.number}` : ""}
                    </div>
                  </div>
                  <div className="hidden sm:block text-xs text-muted-foreground tabular-nums">
                    {new Date(r.created_at).toLocaleDateString("fr-FR")}
                  </div>
                  {r.total_ttc != null && (
                    <div className="text-sm font-display font-semibold tabular-nums w-28 text-right">
                      {Number(r.total_ttc).toFixed(3)} <span className="text-[10px] text-muted-foreground">DT</span>
                    </div>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => view(r)} aria-label="Voir" title="Voir">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => download(r)} aria-label="Télécharger" title="Télécharger">
                    <Download className="h-4 w-4" />
                  </Button>
                  {canDelete && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" aria-label="Supprimer">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Cette action est irréversible. Le PDF associé sera également supprimé.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteDocument(r)}>Supprimer</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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
