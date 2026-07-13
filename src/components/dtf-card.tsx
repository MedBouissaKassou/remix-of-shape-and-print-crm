import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Download, FileSpreadsheet, Loader2, Plus, Save, Trash2,
  Layers, Package, Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { addDtfAdvance, updateDtf } from "@/lib/documents.functions";
import { useAuth } from "@/hooks/use-auth";

type DtfRow = { date: string; number?: string; designation: string; dimension: string; quantity: number; unit_price: number; total_price?: number };
type OtherRow = DtfRow & { type?: string };
type DtfAdvance = { date: string; amount: number; payment_type: string };
type Record = { storage_path: string; rows: DtfRow[]; other_rows: OtherRow[]; advances: DtfAdvance[] } | null;

const dimNum = (s: string) => {
  const n = parseFloat(String(s ?? "").replace(",", "."));
  return Number.isNaN(n) ? 0 : n;
};
const dtfRowTotal = (r: DtfRow) => +(dimNum(r.dimension) * (Number(r.quantity) || 0) * (Number(r.unit_price) || 0)).toFixed(3);
const otherRowTotal = (r: OtherRow) => +((Number(r.quantity) || 0) * (Number(r.unit_price) || 0)).toFixed(3);

export function DtfCard({ clientId }: { clientId: string }) {
  const [rec, setRec] = useState<Record>(null);
  const [rows, setRows] = useState<DtfRow[]>([]);
  const [otherRows, setOtherRows] = useState<OtherRow[]>([]);
  const [advances, setAdvances] = useState<DtfAdvance[]>([]);
  const [loading, setLoading] = useState(true);
  const [advOpen, setAdvOpen] = useState(false);
  const [adv, setAdv] = useState<DtfAdvance>({ date: new Date().toISOString().slice(0, 10), amount: 0, payment_type: "Espèces" });
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const { hasAnyRole } = useAuth();
  const canEdit = hasAnyRole(["super_admin", "admin", "marketing", "design", "dtf"]);
  const addAdvFn = useServerFn(addDtfAdvance);
  const updateFn = useServerFn(updateDtf);

  const getServerFnHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Session expirée, reconnecte-toi.");
    return { authorization: `Bearer ${session.access_token}` };
  };

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("client_dtf_files" as any).select("*").eq("client_id", clientId).maybeSingle();
    const r = data as any;
    setRec(r ?? null);
    setRows((r?.rows as DtfRow[]) ?? []);
    setOtherRows((r?.other_rows as OtherRow[]) ?? []);
    setAdvances((r?.advances as DtfAdvance[]) ?? []);
    setDirty(false);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [clientId]);

  const download = async () => {
    if (!rec) return;
    const { data, error } = await supabase.storage.from("dtf-excel").createSignedUrl(rec.storage_path, 60);
    if (error || !data) { toast.error("Lien indisponible"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const persist = async (next: { rows?: DtfRow[]; otherRows?: OtherRow[]; advances?: DtfAdvance[] }) => {
    setBusy(true);
    try {
      const nRows = (next.rows ?? rows).map((r) => ({ ...r, total_price: dtfRowTotal(r) }));
      const nOther = (next.otherRows ?? otherRows).map((r) => ({ ...r, total_price: otherRowTotal(r) }));
      await updateFn({
        data: { clientId, rows: nRows, otherRows: nOther, advances: next.advances ?? advances },
        headers: await getServerFnHeaders(),
      });
      toast.success("Fichier mis à jour");
      setDirty(false);
      void load();
    } catch (e: any) { toast.error("Échec : " + (e?.message ?? "inconnu")); }
    finally { setBusy(false); }
  };

  const submitAdvance = async () => {
    setBusy(true);
    try {
      await addAdvFn({ data: { clientId, ...adv }, headers: await getServerFnHeaders() });
      toast.success("Acompte enregistré");
      setAdvOpen(false);
      void load();
    } catch (e: any) { toast.error("Échec : " + (e?.message ?? "inconnu")); }
    finally { setBusy(false); }
  };

  const updateRow = (idx: number, patch: Partial<DtfRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r))); setDirty(true);
  };
  const updateOtherRow = (idx: number, patch: Partial<OtherRow>) => {
    setOtherRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r))); setDirty(true);
  };
  const updateAdv = (idx: number, patch: Partial<DtfAdvance>) => {
    setAdvances((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a))); setDirty(true);
  };

  const addRow = (kind: "dtf" | "other") => {
    const blank = { date: new Date().toISOString().slice(0, 10), designation: "", dimension: "", quantity: 1, unit_price: 0 };
    if (kind === "dtf") setRows((p) => [...p, blank]); else setOtherRows((p) => [...p, blank]);
    setDirty(true);
  };

  const removeRow = (kind: "dtf" | "other", idx: number) => {
    if (kind === "dtf") setRows((p) => p.filter((_, i) => i !== idx));
    else setOtherRows((p) => p.filter((_, i) => i !== idx));
    setDirty(true);
  };
  const removeAdv = (idx: number) => { setAdvances((p) => p.filter((_, i) => i !== idx)); setDirty(true); };

  const totalDtf = rows.reduce((s, r) => s + dtfRowTotal(r), 0);
  const totalOther = otherRows.reduce((s, r) => s + otherRowTotal(r), 0);
  const totalCmd = totalDtf + totalOther;
  const totalAdv = advances.reduce((s, a) => s + Number(a.amount), 0);
  const reste = totalCmd - totalAdv;

  return (
    <Card className="lg:col-span-3 shadow-[var(--shadow-soft)] border-border/60 overflow-hidden">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between space-y-0 bg-gradient-to-br from-primary/5 to-transparent border-b border-border/60">
        <div className="min-w-0">
          <CardTitle className="text-base flex items-center gap-2 font-display">
            <FileSpreadsheet className="h-4 w-4 text-primary" />
            Fichier client — Historique DTF &amp; autres impressions
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-2xl">
            Suivi détaillé des transferts <strong className="text-foreground/80">DTF</strong>, des
            <strong className="text-foreground/80"> autres impressions</strong> (broderie, sublimation, sérigraphie…)
            et des <strong className="text-foreground/80">acomptes</strong> versés par ce client.
            Le total restant à payer se met à jour automatiquement.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {rec && <Button size="sm" variant="outline" onClick={download}><Download className="h-4 w-4 mr-2" />Excel</Button>}
          {canEdit && dirty && (
            <Button size="sm" onClick={() => persist({})} disabled={busy} className="shadow-[var(--shadow-glow)]">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Enregistrer
            </Button>
          )}
          {canEdit && rec && (
            <Dialog open={advOpen} onOpenChange={setAdvOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="border-accent/50 text-accent-foreground">
                  <Wallet className="h-4 w-4 mr-2" />Acompte client
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Enregistrer un acompte client</DialogTitle>
                </DialogHeader>
                <p className="text-xs text-muted-foreground -mt-2 mb-2">
                  Un acompte est un paiement partiel reçu du client avant la livraison finale.
                  Il sera déduit du total dû dans le récapitulatif ci-dessous.
                </p>
                <div className="space-y-3">
                  <div><Label>Date du paiement</Label><Input type="date" value={adv.date} onChange={(e) => setAdv({ ...adv, date: e.target.value })} /></div>
                  <div><Label>Montant (DT)</Label><Input type="number" step="0.001" placeholder="0,000" value={adv.amount} onChange={(e) => setAdv({ ...adv, amount: Number(e.target.value) })} /></div>
                  <div><Label>Mode de paiement</Label><Input value={adv.payment_type} onChange={(e) => setAdv({ ...adv, payment_type: e.target.value })} placeholder="Espèces, Virement, Chèque, TPE…" /></div>
                  <Button onClick={submitAdvance} disabled={busy} className="w-full">
                    {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Enregistrer l'acompte
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : !rec ? (
          <div className="py-10 text-sm text-muted-foreground text-center border border-dashed rounded-lg">
            <FileSpreadsheet className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <div className="font-medium text-foreground">Aucun fichier client</div>
            <p className="mt-1 text-xs max-w-sm mx-auto">
              Le fichier sera créé automatiquement dès la première commande DTF de ce client.
            </p>
          </div>
        ) : (
          <Tabs defaultValue="dtf" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-3">
              <TabsTrigger value="dtf" className="gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                <Layers className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Fichiers DTF</span>
                <span className="sm:hidden">DTF</span>
                <span className="font-mono text-[10px] opacity-70">({rows.length})</span>
              </TabsTrigger>
              <TabsTrigger value="other" className="gap-2 data-[state=active]:bg-info/10 data-[state=active]:text-info">
                <Package className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Autres impressions</span>
                <span className="sm:hidden">Autres</span>
                <span className="font-mono text-[10px] opacity-70">({otherRows.length})</span>
              </TabsTrigger>
              <TabsTrigger value="adv" className="gap-2 data-[state=active]:bg-accent/30 data-[state=active]:text-accent-foreground">
                <Wallet className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Acomptes client</span>
                <span className="sm:hidden">Acomptes</span>
                <span className="font-mono text-[10px] opacity-70">({advances.length})</span>
              </TabsTrigger>
            </TabsList>

            {/* DTF */}
            <TabsContent value="dtf" className="space-y-3">
              <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                Transferts <strong className="text-foreground">DTF</strong> imprimés.
                Le total est calculé : <span className="font-mono">Dimension (ML) × Quantité × PU</span>.
              </div>
              <div className="overflow-x-auto rounded-md border border-border/60">
                <table className="w-full text-xs align-middle">
                  <colgroup>
                    <col style={{ width: "120px" }} /><col style={{ width: "90px" }} />
                    <col /><col style={{ width: "120px" }} />
                    <col style={{ width: "70px" }} /><col style={{ width: "90px" }} />
                    <col style={{ width: "100px" }} /><col style={{ width: "40px" }} />
                  </colgroup>
                  <thead className="bg-muted/40 text-muted-foreground font-mono uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="text-left p-2">Date</th><th className="text-left p-2">N°</th>
                      <th className="text-left p-2">Désignation</th><th className="text-left p-2">Dimension (ML)</th>
                      <th className="text-right p-2">Qté</th><th className="text-right p-2">PU</th>
                      <th className="text-right p-2">Total</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-t border-border/60 align-middle hover:bg-muted/20">
                        <td className="p-1"><Input className="h-7 text-xs w-full" type="date" value={r.date} onChange={(e) => updateRow(i, { date: e.target.value })} disabled={!canEdit} /></td>
                        <td className="p-1"><Input className="h-7 text-xs w-full font-mono" value={r.number ?? ""} onChange={(e) => updateRow(i, { number: e.target.value })} disabled={!canEdit} placeholder="—" /></td>
                        <td className="p-1"><Input className="h-7 text-xs w-full" value={r.designation} onChange={(e) => updateRow(i, { designation: e.target.value })} disabled={!canEdit} placeholder="Ex : Logo polo" /></td>
                        <td className="p-1"><Input className="h-7 text-xs w-full" value={r.dimension} onChange={(e) => updateRow(i, { dimension: e.target.value, total_price: undefined })} disabled={!canEdit} placeholder="50, 30x40…" /></td>
                        <td className="p-1"><Input className="h-7 text-xs w-full text-right" type="number" value={r.quantity} onChange={(e) => updateRow(i, { quantity: Number(e.target.value), total_price: undefined })} disabled={!canEdit} /></td>
                        <td className="p-1"><Input className="h-7 text-xs w-full text-right" type="number" step="0.001" value={r.unit_price} onChange={(e) => updateRow(i, { unit_price: Number(e.target.value), total_price: undefined })} disabled={!canEdit} /></td>
                        <td className="p-1 text-right tabular-nums font-mono font-medium">{dtfRowTotal(r).toFixed(3)}</td>
                        <td className="p-1 text-right">{canEdit && <Button size="sm" variant="ghost" onClick={() => removeRow("dtf", i)} aria-label="Supprimer la ligne"><Trash2 className="h-3 w-3 text-destructive" /></Button>}</td>
                      </tr>
                    ))}
                    {rows.length === 0 && <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">Aucun transfert DTF enregistré pour ce client.</td></tr>}
                  </tbody>
                </table>
              </div>
              {canEdit && <Button size="sm" variant="outline" onClick={() => addRow("dtf")}><Plus className="h-3 w-3 mr-1" />Ajouter une ligne DTF</Button>}
            </TabsContent>

            {/* AUTRES */}
            <TabsContent value="other" className="space-y-3">
              <div className="rounded-md border border-info/20 bg-info/5 px-3 py-2 text-xs text-muted-foreground">
                Autres prestations d'impression (broderie, sublimation, sérigraphie, flex…).
                Le total est calculé : <span className="font-mono">Quantité × PU</span>.
              </div>
              <div className="overflow-x-auto rounded-md border border-border/60">
                <table className="w-full text-xs align-middle">
                  <colgroup>
                    <col style={{ width: "120px" }} /><col style={{ width: "90px" }} />
                    <col style={{ width: "110px" }} /><col />
                    <col style={{ width: "100px" }} /><col style={{ width: "70px" }} />
                    <col style={{ width: "90px" }} /><col style={{ width: "100px" }} />
                    <col style={{ width: "40px" }} />
                  </colgroup>
                  <thead className="bg-muted/40 text-muted-foreground font-mono uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="text-left p-2">Date</th><th className="text-left p-2">N°</th>
                      <th className="text-left p-2">Type</th><th className="text-left p-2">Désignation</th>
                      <th className="text-left p-2">Taille</th><th className="text-right p-2">Qté</th>
                      <th className="text-right p-2">PU</th><th className="text-right p-2">Total</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {otherRows.map((r, i) => (
                      <tr key={i} className="border-t border-border/60 align-middle hover:bg-muted/20">
                        <td className="p-1"><Input className="h-7 text-xs w-full" type="date" value={r.date} onChange={(e) => updateOtherRow(i, { date: e.target.value })} disabled={!canEdit} /></td>
                        <td className="p-1"><Input className="h-7 text-xs w-full font-mono" value={r.number ?? ""} onChange={(e) => updateOtherRow(i, { number: e.target.value })} disabled={!canEdit} /></td>
                        <td className="p-1"><Input className="h-7 text-xs w-full" value={r.type ?? ""} onChange={(e) => updateOtherRow(i, { type: e.target.value })} disabled={!canEdit} placeholder="Broderie…" /></td>
                        <td className="p-1"><Input className="h-7 text-xs w-full" value={r.designation} onChange={(e) => updateOtherRow(i, { designation: e.target.value })} disabled={!canEdit} placeholder="Désignation" /></td>
                        <td className="p-1"><Input className="h-7 text-xs w-full" value={r.dimension} onChange={(e) => updateOtherRow(i, { dimension: e.target.value })} disabled={!canEdit} placeholder="M, L, 30x40…" /></td>
                        <td className="p-1"><Input className="h-7 text-xs w-full text-right" type="number" value={r.quantity} onChange={(e) => updateOtherRow(i, { quantity: Number(e.target.value), total_price: undefined })} disabled={!canEdit} /></td>
                        <td className="p-1"><Input className="h-7 text-xs w-full text-right" type="number" step="0.001" value={r.unit_price} onChange={(e) => updateOtherRow(i, { unit_price: Number(e.target.value), total_price: undefined })} disabled={!canEdit} /></td>
                        <td className="p-1 text-right tabular-nums font-mono font-medium">{otherRowTotal(r).toFixed(3)}</td>
                        <td className="p-1 text-right">{canEdit && <Button size="sm" variant="ghost" onClick={() => removeRow("other", i)} aria-label="Supprimer la ligne"><Trash2 className="h-3 w-3 text-destructive" /></Button>}</td>
                      </tr>
                    ))}
                    {otherRows.length === 0 && <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">Aucune autre impression enregistrée pour ce client.</td></tr>}
                  </tbody>
                </table>
              </div>
              {canEdit && <Button size="sm" variant="outline" onClick={() => addRow("other")}><Plus className="h-3 w-3 mr-1" />Ajouter une ligne</Button>}
            </TabsContent>

            {/* ACOMPTES */}
            <TabsContent value="adv" className="space-y-3">
              <div className="rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-muted-foreground">
                Paiements partiels reçus du client. Chaque acompte vient en
                déduction du total dû dans le récapitulatif en bas de carte.
              </div>
              <div className="overflow-x-auto rounded-md border border-border/60">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-muted-foreground font-mono uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="text-left p-2">Date</th>
                      <th className="text-right p-2">Montant (DT)</th>
                      <th className="text-left p-2">Mode de paiement</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {advances.map((a, i) => (
                      <tr key={i} className="border-t border-border/60 hover:bg-muted/20">
                        <td className="p-1"><Input className="h-7 text-xs" type="date" value={a.date} onChange={(e) => updateAdv(i, { date: e.target.value })} disabled={!canEdit} /></td>
                        <td className="p-1"><Input className="h-7 text-xs w-28 text-right font-mono" type="number" step="0.001" value={a.amount} onChange={(e) => updateAdv(i, { amount: Number(e.target.value) })} disabled={!canEdit} /></td>
                        <td className="p-1"><Input className="h-7 text-xs" value={a.payment_type} onChange={(e) => updateAdv(i, { payment_type: e.target.value })} disabled={!canEdit} placeholder="Espèces, Virement…" /></td>
                        <td className="p-1 text-right">{canEdit && <Button size="sm" variant="ghost" onClick={() => removeAdv(i)} aria-label="Supprimer l'acompte"><Trash2 className="h-3 w-3 text-destructive" /></Button>}</td>
                      </tr>
                    ))}
                    {advances.length === 0 && (
                      <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">
                        Aucun acompte enregistré. Cliquez sur <strong className="text-foreground">Acompte client</strong> en haut pour en ajouter un.
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* RECAP */}
        {rec && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-t border-border/60 pt-4 mt-4">
            <RecapTile label="Total DTF" value={totalDtf} tone="primary" />
            <RecapTile label="Autres impressions" value={totalOther} tone="info" />
            <RecapTile label="Acomptes reçus" value={totalAdv} tone="accent" />
            <RecapTile label="Reste à payer" value={reste} tone={reste > 0 ? "destructive" : "success"} bold />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecapTile({
  label, value, tone, bold,
}: {
  label: string;
  value: number;
  tone: "primary" | "info" | "accent" | "destructive" | "success";
  bold?: boolean;
}) {
  const ring = {
    primary:     "border-primary/30 bg-primary/5",
    info:        "border-info/30 bg-info/5",
    accent:      "border-accent/40 bg-accent/10",
    destructive: "border-destructive/40 bg-destructive/10",
    success:     "border-success/30 bg-success/10",
  } as const;
  const text = {
    primary:     "text-primary",
    info:        "text-info",
    accent:      "text-accent-foreground",
    destructive: "text-destructive",
    success:     "text-success",
  } as const;
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${ring[tone]}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">{label}</div>
      <div className={`mt-1 font-display tabular-nums ${bold ? "text-lg font-bold" : "text-base font-semibold"} ${text[tone]}`}>
        {value.toFixed(3)} <span className="text-[10px] opacity-70">DT</span>
      </div>
    </div>
  );
}
