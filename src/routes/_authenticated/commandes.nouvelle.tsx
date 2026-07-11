import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
import { DtfCard } from "@/components/dtf-card";
import { ArrowLeft, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { appendCommandeToClientFile } from "@/lib/documents.functions";

export const Route = createFileRoute("/_authenticated/commandes/nouvelle")({
  head: () => ({ meta: [{ title: "Nouvelle commande — ShapeAndPrint CRM" }] }),
  component: NewCommande,
});

type ClientLite = { id: string; full_name: string; company_name: string | null; phone: string | null };
type TypeRow = { id: string; name: string };
type Item = {
  order_type_id: string;
  designation: string;
  dimension: string;
  quantity: number | "";
  unit_price: string;
  tva_rate: string;
  color: string;
};

const blankItem = (): Item => ({
  order_type_id: "", designation: "", dimension: "",
  quantity: 1, unit_price: "", tva_rate: "0", color: "",
});

const parseDecimal = (value: string | null | undefined, fallback = 0) => {
  const normalized = (value ?? "").trim().replace(",", ".");
  if (!normalized) return fallback;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const qtyNum = (q: number | ""): number => (q === "" ? 0 : q);

function NewCommande() {
  const navigate = useNavigate();
  const { user, hasRole, hasAnyRole } = useAuth();
  const isAdmin = hasAnyRole(["super_admin", "admin"]);
  if (!hasAnyRole(["super_admin", "admin", "marketing", "design", "dtf"])) {
    return <div className="p-6 text-sm text-muted-foreground">Accès réservé.</div>;
  }

  const [clients, setClients] = useState<ClientLite[]>([]);
  const [types, setTypes] = useState<TypeRow[]>([]);
  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [items, setItems] = useState<Item[]>([blankItem()]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [clientOpen, setClientOpen] = useState(false);
  const [newType, setNewType] = useState("");
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");
  const [deadline, setDeadline] = useState<string>(""); // datetime-local value
  const [avance, setAvance] = useState<string>("");
  const [paid, setPaid] = useState<boolean>(false);
  const [discount, setDiscount] = useState<string>("0");
  const [itemFiles, setItemFiles] = useState<Record<number, File[]>>({});
  const appendFn = useServerFn(appendCommandeToClientFile);

  const loadAll = async () => {
    const [{ data: cs }, { data: ts }] = await Promise.all([
      supabase.from("clients").select("id, full_name, company_name, phone").order("full_name"),
      supabase.from("order_types").select("id, name").eq("active", true).order("name"),
    ]);
    setClients((cs as ClientLite[]) ?? []);
    setTypes((ts as TypeRow[]) ?? []);
  };
  useEffect(() => { void loadAll(); }, []);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients.slice(0, 8);
    return clients.filter((c) =>
      [c.full_name, c.company_name, c.phone].filter(Boolean).some((v) => (v as string).toLowerCase().includes(q)),
    ).slice(0, 8);
  }, [clients, search]);

  const selectedClient = clients.find((c) => c.id === clientId) ?? null;

  const hasDtfItem = useMemo(
    () => items.some((it) => {
      const t = types.find((x) => x.id === it.order_type_id);
      return (t?.name ?? "").toLowerCase().includes("dtf");
    }),
    [items, types],
  );

  const isDtf = (typeId: string) => {
    const t = types.find((x) => x.id === typeId);
    return (t?.name ?? "").toLowerCase().includes("dtf");
  };

  const itemTotals = items.map((it) => {
    const u = parseDecimal(it.unit_price, Number.NaN);
    const q = qtyNum(it.quantity);
    let ht = 0;
    let metrage = 0;
    if (!Number.isNaN(u)) {
      if (isDtf(it.order_type_id)) {
        const dim = parseFloat((it.dimension || "").replace(",", "."));
        metrage = Number.isNaN(dim) ? 0 : +(dim * q).toFixed(3);
        ht = Number.isNaN(dim) ? 0 : +(metrage * u).toFixed(3);
      } else {
        ht = +(u * q).toFixed(3);
      }
    } else if (isDtf(it.order_type_id)) {
      const dim = parseFloat((it.dimension || "").replace(",", "."));
      metrage = Number.isNaN(dim) ? 0 : +(dim * q).toFixed(3);
    }
    const rate = parseDecimal(it.tva_rate, Number.NaN);
    const tva = Number.isNaN(rate) ? 0 : +(ht * (rate / 100)).toFixed(3);
    return { ht, tva, ttc: +(ht + tva).toFixed(3), metrage };
  });
  const totalHt = itemTotals.reduce((s, t) => s + t.ht, 0);
  const totalTva = itemTotals.reduce((s, t) => s + t.tva, 0);
  const discountRate = Math.max(0, Math.min(100, parseFloat((discount || "0").replace(",", ".")) || 0));
  const discountHt = +(totalHt * (discountRate / 100)).toFixed(3);
  const totalHtNet = +(totalHt - discountHt).toFixed(3);
  const totalTvaNet = +(totalTva - totalTva * (discountRate / 100)).toFixed(3);
  const totalTtc = +(totalHtNet + totalTvaNet).toFixed(3);
  const hasSelectedClient = Boolean(clientId && selectedClient);
  const hasValidItems = items.some((it) => it.order_type_id || it.designation.trim());
  const createDisabledReason = !hasSelectedClient
    ? "Sélectionnez un client dans la liste pour activer la création."
    : !hasValidItems
      ? "Choisissez au moins un type ou une désignation produit."
      : null;

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
    const { data, error } = await supabase.from("clients").insert(payload).select("id, full_name, company_name, phone").single();
    if (error || !data) { toast.error("Échec : " + error?.message); return; }
    toast.success("Client créé");
    setClients((prev) => [data as ClientLite, ...prev]);
    setClientId(data.id);
    setClientOpen(false);
  };

  const addType = async () => {
    if (!newType.trim()) return;
    const { data, error } = await supabase.from("order_types").insert({ name: newType.trim() }).select("id, name").single();
    if (error || !data) { toast.error("Échec : " + error?.message); return; }
    setTypes((prev) => [...prev, data as TypeRow].sort((a, b) => a.name.localeCompare(b.name)));
    setNewType("");
    toast.success("Type ajouté");
  };

  const removeType = async (typeId: string, typeName: string) => {
    if (!confirm(`Supprimer le type « ${typeName} » ? Il ne sera plus proposé dans les nouvelles commandes.`)) return;
    const { error } = await supabase.from("order_types").update({ active: false }).eq("id", typeId);
    if (error) { toast.error("Échec : " + error.message); return; }
    setTypes((prev) => prev.filter((t) => t.id !== typeId));
    setItems((prev) => prev.map((it) => it.order_type_id === typeId ? { ...it, order_type_id: "" } : it));
    toast.success("Type supprimé");
  };

  const getServerFnHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Session expirée.");
    return { authorization: `Bearer ${session.access_token}` };
  };

  const submit = async () => {
    if (!clientId) { toast.error("Choisissez un client"); return; }
    if (items.length === 0) { toast.error("Ajoutez au moins un produit"); return; }
    if (!hasValidItems) { toast.error("Choisissez au moins un type ou une désignation produit"); return; }
    setSubmitting(true);
    try {
      const firstType = items[0].order_type_id || null;
      const { data: cmd, error } = await supabase.from("commandes").insert({
        client_id: clientId,
        order_type_id: firstType,
        description: items.map((it) => it.designation).filter(Boolean).join(" · ") || null,
        quantity: items.reduce((s, it) => s + qtyNum(it.quantity), 0),
        unit_price: items[0].unit_price ? parseDecimal(items[0].unit_price) : null,
        total_price: totalHtNet,
        tva_rate: items[0].tva_rate ? parseDecimal(items[0].tva_rate, 19) : 19,
        tva_amount: totalTvaNet,
        discount_rate: discountRate,
        comment: comment || null,
        priority,
        deadline: priority === "urgent" && deadline ? new Date(deadline).toISOString() : null,
        avance: paid
          ? totalTtc
          : (avance ? Math.round(parseDecimal(avance) * 1000) / 1000 : 0),
        paid,
        created_by: user?.id ?? null,
      } as any).select("id").single();
      if (error || !cmd) throw error ?? new Error("inconnu");

      // Insertion des items
      const itemsPayload = items.map((it, i) => ({
        commande_id: cmd.id,
        position: i,
        order_type_id: it.order_type_id || null,
        designation: it.designation || null,
        dimension: it.dimension || null,
        quantity: it.quantity === "" ? 1 : it.quantity,
        unit_price: it.unit_price ? parseDecimal(it.unit_price) : null,
        total_ht: itemTotals[i].ht,
        tva_rate: it.tva_rate ? parseDecimal(it.tva_rate, 19) : 19,
        tva_amount: itemTotals[i].tva,
        total_ttc: itemTotals[i].ttc,
        color: it.color || null,
        total_metrage: isDtf(it.order_type_id) ? itemTotals[i].metrage : null,
      }));
      const { data: insertedItems, error: itErr } = await supabase
        .from("commande_items" as any)
        .insert(itemsPayload)
        .select("id, position");
      if (itErr) throw itErr;

      // Upload per-item files
      const itemsArr = ((insertedItems ?? []) as unknown) as Array<{ id: string; position: number }>;
      for (const [idxStr, fs] of Object.entries(itemFiles)) {
        const i = Number(idxStr);
        const itemRow = itemsArr.find((x) => x.position === i);
        if (!itemRow || !fs?.length) continue;
        for (const f of fs) {
          const path = `${cmd.id}/items/${itemRow.id}/${Date.now()}-${f.name.replace(/[^\w.\-]/g, "_")}`;
          const { error: upErr } = await supabase.storage.from("commande-files").upload(path, f);
          if (upErr) { toast.error("Fichier " + f.name + " : " + upErr.message); continue; }
          await supabase.from("commande_files").insert({
            commande_id: cmd.id, commande_item_id: itemRow.id,
            file_name: f.name, storage_path: path,
            mime_type: f.type || null, size_bytes: f.size, uploaded_by: user?.id ?? null,
          });
        }
      }

      // Génère/met à jour le fichier Excel client (DTF + Autres)
      try {
        await appendFn({ data: { commandeId: cmd.id }, headers: await getServerFnHeaders() });
      } catch (e: any) {
        toast.error("Fichier client : " + (e?.message ?? "erreur"));
      }

      toast.success("Commande créée");
      navigate({ to: "/commandes/$id", params: { id: cmd.id } });
    } catch (e: any) {
      toast.error("Échec : " + (e?.message ?? "inconnu"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link to="/commandes"><ArrowLeft className="h-4 w-4 mr-2" />Retour</Link>
      </Button>
      <PageHeader
        eyebrow="Production"
        title="Nouvelle commande"
        description="Créer une commande pour un client existant"
        helper="Renseignez le client, le type de prestation, les lignes de commande avec leurs dimensions, prix et quantité. Le total HT, TVA et TTC se calculent automatiquement."
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
                    <Select value={it.order_type_id} onValueChange={(v) => updateItem(idx, { order_type_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Choisir un type" /></SelectTrigger>
                      <SelectContent>
                        {types.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
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
                    <Label>{isDtf(it.order_type_id) ? "Dimension (ML)" : "Taille"}</Label>
                    <Input
                      value={it.dimension}
                      onChange={(e) => updateItem(idx, { dimension: e.target.value })}
                      placeholder={isDtf(it.order_type_id) ? "ex: 1.5 (ML)" : "ex: 30x40, A3, M, L…"}
                    />
                  </div>
                  <div>
                    <Label>Quantité</Label>
                    <Input type="number" min={1} value={it.quantity} onChange={(e) => {
                      const val = e.target.value;
                      updateItem(idx, { quantity: val === "" ? "" : Math.max(1, Number(val)) });
                    }} />
                  </div>
                  <div>
                    <Label>Prix unitaire</Label>
                    <Input type="number" step="0.001" value={it.unit_price} onChange={(e) => updateItem(idx, { unit_price: e.target.value })} />
                  </div>
                  <div>
                    <Label>TVA (%)</Label>
                    <Input type="number" step="0.01" value={it.tva_rate} onChange={(e) => updateItem(idx, { tva_rate: e.target.value })} />
                  </div>
                  <div>
                    <Label>Couleur / support</Label>
                    <Input value={it.color} onChange={(e) => updateItem(idx, { color: e.target.value })} />
                  </div>
                  <div>
                    <Label>Total HT</Label>
                    <Input value={itemTotals[idx].ht.toFixed(3) + " DT"} readOnly />
                  </div>
                  <div>
                    <Label>TVA</Label>
                    <Input value={itemTotals[idx].tva.toFixed(3) + " DT"} readOnly />
                  </div>
                  <div>
                    <Label>Total TTC</Label>
                    <Input value={itemTotals[idx].ttc.toFixed(3) + " DT"} readOnly />
                  </div>
                  {isDtf(it.order_type_id) && (
                    <div>
                      <Label>Total Métrage (ML)</Label>
                      <Input value={itemTotals[idx].metrage.toFixed(3)} readOnly disabled />
                    </div>
                  )}
                </div>
                <div>
                  <Label>Fichiers de ce produit</Label>
                  <Input
                    type="file"
                    multiple
                    onChange={(e) => {
                      const picked = Array.from(e.target.files ?? []);
                      if (!picked.length) return;
                      setItemFiles((p) => ({ ...p, [idx]: [...(p[idx] ?? []), ...picked] }));
                      e.target.value = "";
                    }}
                  />
                  {(itemFiles[idx]?.length ?? 0) > 0 && (
                    <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                      {itemFiles[idx].map((f, fi) => (
                        <li key={fi} className="flex items-center justify-between gap-2 border rounded px-2 py-1">
                          <span className="truncate">{f.name}</span>
                          <button type="button" className="text-destructive hover:underline"
                            onClick={() => setItemFiles((p) => ({ ...p, [idx]: (p[idx] ?? []).filter((_, k) => k !== fi) }))}>
                            Retirer
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          <Button variant="outline" onClick={addItem} className="w-full">
            <Plus className="h-4 w-4 mr-2" />Ajouter un produit
          </Button>

          {isAdmin && (
            <Card className="shadow-[var(--shadow-soft)]">
              <CardHeader><CardTitle className="text-base">Gérer les types</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input placeholder="Ajouter un type…" value={newType} onChange={(e) => setNewType(e.target.value)} />
                  <Button type="button" variant="outline" onClick={addType}><Plus className="h-4 w-4" /></Button>
                </div>
                {types.length > 0 && (
                  <ul className="space-y-1.5 border-t border-border/60 pt-3">
                    {types.map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-2 text-sm rounded-md px-2 py-1.5 bg-muted/40">
                        <span className="truncate">{t.name}</span>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => removeType(t.id, t.name)} aria-label={`Supprimer ${t.name}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="shadow-[var(--shadow-soft)]">
            <CardHeader><CardTitle className="text-base">Commentaire & paiement</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Priorité</Label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as "normal" | "urgent")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {priority === "urgent" && (
                  <div>
                    <Label>Date limite</Label>
                    <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                  </div>
                )}
              </div>
              <div>
                <Label>Commentaire</Label>
                <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Avance (DT)</Label>
                  <Input type="number" step="0.001" value={avance} disabled={paid}
                    onChange={(e) => setAvance(e.target.value)} placeholder="0.000" />
                </div>
                <div className="flex items-end">
                  <Button type="button" variant={paid ? "default" : "outline"} className="w-full"
                    onClick={() => setPaid((p) => !p)}>
                    {paid ? "✓ Payé en totalité" : "Marquer comme payé"}
                  </Button>
                </div>
              </div>
              <div>
                <Label>Remise (%)</Label>
                <Input type="number" step="0.01" min={0} max={100} value={discount}
                  onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
              </div>
            </CardContent>
          </Card>

          {hasDtfItem && clientId && <DtfCard clientId={clientId} />}
        </div>

        <Card className="shadow-[var(--shadow-soft)] h-fit lg:sticky lg:top-4">
          <CardHeader><CardTitle className="text-base">Récapitulatif</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Client" value={selectedClient?.full_name ?? "—"} />
            <Row label="Produits" value={String(items.length)} />
            <Row label="Total HT" value={totalHt.toFixed(3) + " DT"} />
            {discountRate > 0 && (
              <>
                <Row label={`Remise (${discountRate}%)`} value={"-" + discountHt.toFixed(3) + " DT"} />
                <Row label="Total HT net" value={totalHtNet.toFixed(3) + " DT"} />
              </>
            )}
            <Row label="TVA" value={totalTvaNet.toFixed(3) + " DT"} />
            <Row label="Total TTC" value={totalTtc.toFixed(3) + " DT"} />
            <Button
              className="mt-3 h-11 w-full bg-gradient-to-r from-primary to-primary/80 font-display text-sm shadow-[var(--shadow-glow)] hover:from-primary/90 hover:to-primary disabled:bg-muted disabled:bg-none disabled:shadow-none"
              onClick={submit}
              disabled={submitting || Boolean(createDisabledReason)}
            >
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              {submitting ? "Création en cours…" : "Créer la commande"}
            </Button>
            {createDisabledReason && (
              <p className="text-xs text-muted-foreground">{createDisabledReason}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Floating Créer la commande — always visible while scrolling */}
      <div className="fixed bottom-4 right-4 z-40 lg:hidden">
        <Button
          size="lg"
          className="h-14 px-6 rounded-full shadow-[var(--shadow-glow)] bg-gradient-to-r from-primary to-primary/80 font-display"
          onClick={submit}
          disabled={submitting || Boolean(createDisabledReason)}
        >
          {submitting ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
          {submitting ? "Création…" : "Créer la commande"}
        </Button>
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
