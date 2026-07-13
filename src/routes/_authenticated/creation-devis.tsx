import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ClientForm, type ClientFormValues } from "@/components/client-form";
import { ArrowLeft, Download, Eye, Loader2, Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { createStandaloneDevis, getStandaloneDevis } from "@/lib/documents.functions";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/creation-devis")({
  head: () => ({ meta: [{ title: "Création Devis — ShapeAndPrint CRM" }] }),
  validateSearch: (s: Record<string, unknown>) =>
    z.object({ id: z.string().uuid().optional() }).parse(s),
  component: CreationDevis,
});

type ClientLite = { id: string; full_name: string; company_name: string | null; phone: string | null };
type TypeRow = { id: string; name: string };
type Item = {
  type_name: string; // store name to keep payload type-name driven
  designation: string;
  dimension: string;
  quantity: number;
  unit_price: string;
  color: string;
};

const blankItem = (): Item => ({
  type_name: "", designation: "", dimension: "",
  quantity: 1, unit_price: "", color: "",
});

function CreationDevis() {
  const { user, hasAnyRole } = useAuth();
  const { id: editId } = Route.useSearch();
  if (!hasAnyRole(["super_admin", "marketing"])) {
    return <div className="p-6 text-sm text-muted-foreground">Accès réservé.</div>;
  }

  const [clients, setClients] = useState<ClientLite[]>([]);
  const [types, setTypes] = useState<TypeRow[]>([]);
  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [items, setItems] = useState<Item[]>([blankItem()]);
  const [comment, setComment] = useState("");
  const [tvaRate, setTvaRate] = useState<string>("19");
  const [submitting, setSubmitting] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const [savedDevis, setSavedDevis] = useState<{ id: string; number: string; path: string } | null>(null);

  const createFn = useServerFn(createStandaloneDevis);
  const getFn = useServerFn(getStandaloneDevis);

  const getServerFnHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Session expirée, reconnecte-toi.");
    return { authorization: `Bearer ${session.access_token}` };
  };

  useEffect(() => {
    void (async () => {
      const [{ data: cs }, { data: ts }] = await Promise.all([
        supabase.from("clients").select("id, full_name, company_name, phone").order("full_name"),
        supabase.from("order_types").select("id, name").eq("active", true).order("name"),
      ]);
      setClients((cs as ClientLite[]) ?? []);
      setTypes((ts as TypeRow[]) ?? []);
    })();
  }, []);

  // Load existing devis when editing
  useEffect(() => {
    if (!editId) return;
    void (async () => {
      try {
        const row = await getFn({ data: { devisId: editId }, headers: await getServerFnHeaders() });
        setClientId(row.client_id ?? "");
        setTvaRate(String(row.tva_rate ?? 19));
        setComment((row as any).comment ?? "");
        const loadedItems = Array.isArray((row as any).items) ? ((row as any).items as any[]) : [];
        if (loadedItems.length > 0) {
          setItems(loadedItems.map((it) => ({
            type_name: it.type_name ?? "",
            designation: it.designation ?? "",
            dimension: it.dimension ?? "",
            quantity: Number(it.quantity) || 1,
            unit_price: it.unit_price != null ? String(it.unit_price) : "",
            color: it.color ?? "",
          })));
        }
        setSavedDevis({ id: row.id, number: row.number ?? "", path: row.storage_path ?? "" });
      } catch (e: any) {
        toast.error("Devis introuvable");
      }
    })();
  }, [editId]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients.slice(0, 8);
    return clients.filter((c) =>
      [c.full_name, c.company_name, c.phone].filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q)),
    ).slice(0, 8);
  }, [clients, search]);

  const selectedClient = clients.find((c) => c.id === clientId) ?? null;

  const isDtf = (typeName: string) => typeName.toLowerCase().includes("dtf");

  const itemTotals = items.map((it) => {
    const u = parseFloat(it.unit_price);
    if (Number.isNaN(u)) return 0;
    if (isDtf(it.type_name)) {
      const dim = parseFloat((it.dimension || "").replace(",", "."));
      return Number.isNaN(dim) ? 0 : +(dim * it.quantity * u).toFixed(3);
    }
    return +(u * it.quantity).toFixed(3);
  });
  const totalHt = +itemTotals.reduce((s, t) => s + t, 0).toFixed(3);
  const rate = parseFloat(tvaRate) || 0;
  const totalTva = +(totalHt * (rate / 100)).toFixed(3);
  const totalTtc = +(totalHt + totalTva).toFixed(3);

  const updateItem = (idx: number, patch: Partial<Item>) =>
    setItems((p) => p.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const addItem = () => setItems((p) => [...p, blankItem()]);
  const removeItem = (idx: number) => setItems((p) => p.length > 1 ? p.filter((_, i) => i !== idx) : p);

  const createClient = async (v: ClientFormValues) => {
    const payload = {
      ...v,
      company_name: v.client_type === "entreprise" ? v.company_name || null : null,
      tax_id: v.client_type === "entreprise" ? v.tax_id || null : null,
      brand_name: v.client_type === "particulier" ? v.brand_name || null : null,
      contact_origin: v.contact_origin || null,
      contact_origin_other: v.contact_origin === "autre" ? (v.contact_origin_other || null) : null,
      created_by: user?.id ?? null,
    };
    const { data, error } = await supabase.from("clients").insert(payload)
      .select("id, full_name, company_name, phone").single();
    if (error || !data) { toast.error("Échec : " + error?.message); return; }
    toast.success("Client créé");
    setClients((prev) => [data as ClientLite, ...prev]);
    setClientId(data.id);
    setClientOpen(false);
  };

  const save = async () => {
    if (!clientId) { toast.error("Choisissez un client"); return; }
    const validItems = items.filter((it) => it.designation.trim() && it.unit_price);
    if (validItems.length === 0) { toast.error("Ajoutez au moins un produit complet"); return; }
    setSubmitting(true);
    try {
      const result = await createFn({
        data: {
          clientId,
          tvaRate: rate,
          comment: comment || null,
          devisId: savedDevis?.id,
          items: validItems.map((it) => ({
            designation: it.designation,
            type_name: it.type_name || null,
            dimension: it.dimension || null,
            quantity: it.quantity,
            unit_price: Number(it.unit_price) || 0,
            color: it.color || null,
          })),
        },
        headers: await getServerFnHeaders(),
      });
      const path = (result as any).path ?? (result as any).storage_path;
      if (!path) throw new Error("PDF généré sans chemin de fichier");
      setSavedDevis({ id: result.id, number: result.number, path });
      toast.success(savedDevis ? `Devis ${result.number} mis à jour` : `Devis ${result.number} généré avec succès`, {
        description: "Le document a été enregistré. Vous pouvez le visualiser ou le télécharger.",
        duration: 8000,
        action: { label: "Voir", onClick: () => void view() },
        cancel: { label: "Télécharger", onClick: () => void download() },
      });
    } catch (e: any) {
      toast.error("Échec : " + (e?.message ?? "inconnu"));
    } finally {
      setSubmitting(false);
    }
  };

  const view = async () => {
    if (!savedDevis?.path) { toast.error("Sauvegardez d'abord le devis"); return; }
    const { data, error } = await supabase.storage
      .from("documents").createSignedUrl(savedDevis.path, 60);
    if (error || !data) { toast.error("Lien indisponible"); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const download = async () => {
    if (!savedDevis?.path) { toast.error("Sauvegardez d'abord le devis"); return; }
    const filename = `${savedDevis.number}.pdf`;
    const { data, error } = await supabase.storage
      .from("documents").createSignedUrl(savedDevis.path, 60, { download: filename });
    if (error || !data) { toast.error("Lien indisponible"); return; }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link to="/devis"><ArrowLeft className="h-4 w-4 mr-2" />Devis</Link>
      </Button>
      <PageHeader
        eyebrow="Documents commerciaux"
        title="Création de devis"
        description="Créer un devis sans commande liée"
        helper="Idéal pour répondre à une demande de prix avant la création d'une commande. Le devis sera enregistré dans la section Devis et pourra être envoyé au client."
      />

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Client */}
          <Card className="shadow-[var(--shadow-soft)]">
            <CardHeader><CardTitle className="text-base">Client</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    placeholder={selectedClient ? `${selectedClient.full_name}${selectedClient.company_name ? " — " + selectedClient.company_name : ""}` : "Rechercher un client…"}
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setClientId(""); }}
                  />
                  {search && filteredClients.length > 0 && !clientId && (
                    <div className="absolute z-10 mt-1 w-full bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                      {filteredClients.map((c) => (
                        <button key={c.id} type="button" className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                          onClick={() => { setClientId(c.id); setSearch(""); }}>
                          <div className="font-medium">{c.full_name}</div>
                          <div className="text-xs text-muted-foreground">{[c.company_name, c.phone].filter(Boolean).join(" · ")}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Dialog open={clientOpen} onOpenChange={setClientOpen}>
                  <DialogTrigger asChild><Button variant="outline" type="button"><Plus className="h-4 w-4" /></Button></DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Nouveau client</DialogTitle></DialogHeader>
                    <ClientForm onSubmit={createClient} onCancel={() => setClientOpen(false)} submitLabel="Créer" />
                  </DialogContent>
                </Dialog>
              </div>
              {selectedClient && (
                <div className="text-xs text-muted-foreground mt-1">Sélectionné : {selectedClient.full_name}</div>
              )}
            </CardContent>
          </Card>

          {/* Items */}
          {items.map((it, idx) => (
            <Card key={idx} className="shadow-[var(--shadow-soft)]">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Produit {idx + 1}</CardTitle>
                {items.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => removeItem(idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <Label>Type</Label>
                    <Select value={it.type_name} onValueChange={(v) => updateItem(idx, { type_name: v })}>
                      <SelectTrigger><SelectValue placeholder="Choisir un type" /></SelectTrigger>
                      <SelectContent>
                        {types.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Désignation</Label>
                    <Input value={it.designation} onChange={(e) => updateItem(idx, { designation: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <Label>{isDtf(it.type_name) ? "Dimension (ML)" : "Taille"}</Label>
                    <Input
                      value={it.dimension}
                      onChange={(e) => updateItem(idx, { dimension: e.target.value })}
                      placeholder={isDtf(it.type_name) ? "ex: 1.5" : "ex: 30x40, A3, M, L…"}
                    />
                  </div>
                  <div>
                    <Label>Quantité</Label>
                    <Input type="number" min={1} value={it.quantity}
                      onChange={(e) => updateItem(idx, { quantity: Math.max(1, Number(e.target.value) || 1) })} />
                  </div>
                  <div>
                    <Label>Prix unitaire</Label>
                    <Input type="number" step="0.001" value={it.unit_price}
                      onChange={(e) => updateItem(idx, { unit_price: e.target.value })} />
                  </div>
                  <div>
                    <Label>Couleur</Label>
                    <Input value={it.color} onChange={(e) => updateItem(idx, { color: e.target.value })} />
                  </div>
                  <div className="col-span-2 sm:col-span-4">
                    <Label>Total HT ligne</Label>
                    <Input value={itemTotals[idx].toFixed(3) + " DT"} readOnly />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          <Button variant="outline" onClick={addItem} className="w-full">
            <Plus className="h-4 w-4 mr-2" />Ajouter un produit
          </Button>

          <Card className="shadow-[var(--shadow-soft)]">
            <CardHeader><CardTitle className="text-base">Commentaire</CardTitle></CardHeader>
            <CardContent>
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-[var(--shadow-soft)] h-fit">
          <CardHeader><CardTitle className="text-base">Récapitulatif</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Client" value={selectedClient?.full_name ?? "—"} />
            <Row label="Produits" value={String(items.length)} />
            <div className="flex items-center justify-between gap-3 border-b pb-2">
              <span className="text-muted-foreground">TVA (%)</span>
              <Input type="number" step="0.01" value={tvaRate}
                onChange={(e) => setTvaRate(e.target.value)} className="w-24 h-8 text-right" />
            </div>
            <Row label="Total HT" value={totalHt.toFixed(3) + " DT"} />
            <Row label="TVA" value={totalTva.toFixed(3) + " DT"} />
            <Row label="Total TTC" value={totalTtc.toFixed(3) + " DT"} />

            <Button className="w-full mt-3" onClick={save} disabled={submitting || !clientId}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {savedDevis ? "Mettre à jour le devis" : "Sauvegarder"}
            </Button>

            {savedDevis && (
              <div className="space-y-2 pt-2">
                <div className="text-xs text-muted-foreground text-center">
                  Devis <span className="font-medium text-foreground">{savedDevis.number}</span> enregistré
                </div>
                <Button variant="outline" className="w-full" onClick={view}>
                  <Eye className="h-4 w-4 mr-2" />Voir le PDF
                </Button>
                <Button variant="outline" className="w-full" onClick={download}>
                  <Download className="h-4 w-4 mr-2" />Télécharger PDF
                </Button>
                <Button asChild variant="ghost" className="w-full">
                  <Link to="/devis">Voir tous les devis</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b pb-1 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}