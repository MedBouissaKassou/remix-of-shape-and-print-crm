import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ClientForm, type ClientFormValues } from "@/components/client-form";
import { DtfCard } from "@/components/dtf-card";
import { ArrowLeft, Building2, Download, FileText, Loader2, Pencil, Trash2, Upload, User2 } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { STATUS_LABELS, STATUS_COLORS, type CommandeStatus } from "@/lib/commande-status";

const ORIGIN_LABEL: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  whatsapp: "Whatsapp",
  site_web: "Site Web",
  telephone: "Téléphone",
  sur_lieu: "Sur lieu",
  autre: "Autre",
};

type Client = Database["public"]["Tables"]["clients"]["Row"];
type ClientFile = Database["public"]["Tables"]["client_files"]["Row"];
type ClientCmd = {
  id: string; number: string; status: CommandeStatus; created_at: string;
  total_price: number | null; tva_amount: number | null;
  order_types: { name: string } | null;
};

export const Route = createFileRoute("/_authenticated/clients/$clientId")({
  head: () => ({ meta: [{ title: "Client — ShapeAndPrint CRM" }] }),
  component: ClientDetail,
});

function ClientDetail() {
  const { clientId } = Route.useParams();
  const navigate = useNavigate();
  const { user, hasAnyRole } = useAuth();
  const canEdit = hasAnyRole(["super_admin", "admin", "marketing", "design", "dtf"]);
  const canFile = hasAnyRole(["super_admin", "admin", "marketing", "design", "dtf"]);

  const [client, setClient] = useState<Client | null>(null);
  const [files, setFiles] = useState<ClientFile[]>([]);
  const [commandes, setCommandes] = useState<ClientCmd[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: c }, { data: fs }, { data: cs }] = await Promise.all([
      supabase.from("clients").select("*").eq("id", clientId).maybeSingle(),
      supabase.from("client_files").select("*").eq("client_id", clientId).order("created_at", { ascending: false }),
      supabase.from("commandes").select("id, number, status, created_at, total_price, tva_amount, order_types(name)").eq("client_id", clientId).order("created_at", { ascending: false }),
    ]);
    setClient(c);
    setFiles(fs ?? []);
    setCommandes((cs as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [clientId]);

  const handleUpdate = async (values: ClientFormValues) => {
    const { error } = await supabase
      .from("clients")
      .update({
        ...values,
        company_name: values.client_type === "entreprise" ? values.company_name || null : null,
        tax_id: values.client_type === "entreprise" ? values.tax_id || null : null,
        brand_name: values.client_type === "particulier" ? values.brand_name || null : null,
        contact_origin: values.contact_origin || null,
        contact_origin_other: values.contact_origin === "autre" ? (values.contact_origin_other || null) : null,
      })
      .eq("id", clientId);
    if (error) { toast.error("Échec : " + error.message); return; }
    toast.success("Client mis à jour");
    setEditOpen(false);
    void load();
  };

  const handleDelete = async () => {
    const { error } = await supabase.from("clients").delete().eq("id", clientId);
    if (error) { toast.error("Échec : " + error.message); return; }
    toast.success("Client supprimé");
    navigate({ to: "/clients" });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const path = `${clientId}/${Date.now()}-${f.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("client-files").upload(path, f);
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("client_files").insert({
        client_id: clientId,
        file_name: f.name,
        storage_path: path,
        mime_type: f.type || null,
        size_bytes: f.size,
        uploaded_by: user?.id ?? null,
      });
      if (insErr) throw insErr;
      toast.success("Fichier ajouté");
      void load();
    } catch (err: any) {
      toast.error("Échec : " + (err?.message ?? "inconnu"));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const downloadFile = async (cf: ClientFile) => {
    const { data, error } = await supabase.storage.from("client-files").createSignedUrl(cf.storage_path, 60);
    if (error || !data) { toast.error("Lien indisponible"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const deleteFile = async (cf: ClientFile) => {
    const { error: sErr } = await supabase.storage.from("client-files").remove([cf.storage_path]);
    if (sErr) { toast.error("Échec : " + sErr.message); return; }
    const { error: dErr } = await supabase.from("client_files").delete().eq("id", cf.id);
    if (dErr) { toast.error("Échec : " + dErr.message); return; }
    toast.success("Fichier supprimé");
    void load();
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }
  if (!client) {
    return (
      <div>
        <PageHeader title="Client introuvable" />
        <Button asChild variant="outline"><Link to="/clients"><ArrowLeft className="h-4 w-4 mr-2" />Retour</Link></Button>
      </div>
    );
  }

  const Icon = client.client_type === "entreprise" ? Building2 : User2;

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link to="/clients"><ArrowLeft className="h-4 w-4 mr-2" />Retour aux clients</Link>
      </Button>

      <PageHeader
        eyebrow={client.client_type === "entreprise" ? "Fiche entreprise" : "Fiche client"}
        title={client.full_name}
        description={client.company_name || undefined}
        helper="Toutes les informations du client : coordonnées, fichiers (logos, designs, documents…), historique DTF & autres impressions, et commandes liées."
        actions={
          canEdit && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4 mr-2" />Modifier
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive border-destructive/30">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer ce client ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action est irréversible. Tous les fichiers associés seront aussi supprimés.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Supprimer</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )
        }
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1 shadow-[var(--shadow-soft)]">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <div className="h-12 w-12 rounded-full bg-accent flex items-center justify-center">
              <Icon className="h-6 w-6 text-accent-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">Coordonnées</CardTitle>
              <Badge variant="secondary" className="text-[10px] uppercase mt-1">
                {client.client_type === "entreprise" ? "Entreprise" : "Particulier"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <Field label="Téléphone" value={client.phone} />
            <Field label="Téléphone 2" value={(client as any).phone2} />
            <Field label="Email" value={client.email} />
            {client.client_type === "entreprise" && (
              <Field label="Matricule Fiscale" value={(client as any).tax_id} />
            )}
            {client.client_type === "particulier" && (
              <Field label="Nom de Brand" value={(client as any).brand_name} />
            )}
            <Field label="Adresse" value={client.address} />
            <Field label="Gouvernorat" value={(client as any).governorate} />
            <Field label="Ville" value={[client.postal_code, client.city].filter(Boolean).join(" ")} />
            <Field
              label="Origine de contact"
              value={
                (client as any).contact_origin === "autre"
                  ? ((client as any).contact_origin_other || "Autre")
                  : ORIGIN_LABEL[(client as any).contact_origin as string] ?? null
              }
            />
            {client.notes && (
              <div className="pt-2 border-t">
                <div className="text-xs text-muted-foreground mb-1">Notes</div>
                <div className="whitespace-pre-wrap">{client.notes}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-[var(--shadow-soft)] border-border/60">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 border-b border-border/60">
            <div>
              <CardTitle className="text-base font-display">Documents du client ({files.length})</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Logos, designs, brief, BAT, photos… Fichiers généraux liés au client (hors DTF, voir bloc dédié ci-dessous).
              </p>
            </div>
            {canFile && (
              <>
                <input ref={fileInput} type="file" className="hidden" onChange={handleUpload} />
                <Button size="sm" onClick={() => fileInput.current?.click()} disabled={uploading} className="shrink-0">
                  {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Téléverser
                </Button>
              </>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {files.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                <FileText className="h-8 w-8 opacity-30" />
                <div>Aucun document</div>
                <p className="text-xs max-w-xs">Téléversez logos, designs, briefs ou tout document utile à ce client.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {files.map((f) => (
                  <div key={f.id} className="p-3 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                    <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{f.file_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {f.size_bytes ? formatSize(f.size_bytes) : ""}{f.mime_type ? ` · ${f.mime_type}` : ""}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => downloadFile(f)} aria-label="Télécharger">
                      <Download className="h-4 w-4" />
                    </Button>
                    {canFile && (
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteFile(f)} aria-label="Supprimer">
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

      <div className="grid lg:grid-cols-3 gap-4 mt-6">
        <DtfCard clientId={clientId} />
      </div>

      <Card className="shadow-[var(--shadow-soft)] mt-6 border-border/60">
        <CardHeader className="border-b border-border/60">
          <CardTitle className="text-base font-display">Commandes du client ({commandes.length})</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Historique complet des commandes liées à ce client, du plus récent au plus ancien.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          {commandes.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Aucune commande</div>
          ) : (
            <div className="divide-y">
              {commandes.map((c) => {
                const ttc = Number(c.total_price ?? 0) + Number(c.tva_amount ?? 0);
                return (
                  <Link key={c.id} to="/commandes/$id" params={{ id: c.id }} className="flex items-center gap-3 p-3 hover:bg-accent/40 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{c.number}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString("fr-FR")}
                        {c.order_types?.name ? ` · ${c.order_types.name}` : ""}
                      </div>
                    </div>
                    <Badge className={STATUS_COLORS[c.status]} variant="secondary">{STATUS_LABELS[c.status]}</Badge>
                    <div className="text-sm font-medium tabular-nums w-28 text-right">{ttc.toFixed(3)} DT</div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Modifier le client</DialogTitle></DialogHeader>
          <ClientForm
            initial={{
              full_name: client.full_name,
              phone: client.phone ?? "",
              phone2: (client as any).phone2 ?? "",
              email: client.email ?? "",
              address: client.address ?? "",
              governorate: (client as any).governorate ?? "",
              city: client.city ?? "",
              postal_code: client.postal_code ?? "",
              client_type: client.client_type,
              company_name: client.company_name ?? "",
              notes: client.notes ?? "",
              brand_name: (client as any).brand_name ?? "",
              tax_id: (client as any).tax_id ?? "",
              contact_origin: ((client as any).contact_origin ?? "") as any,
              contact_origin_other: (client as any).contact_origin_other ?? "",
            }}
            onSubmit={handleUpdate}
            onCancel={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div>{value}</div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}