import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole, ROLE_LABELS } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Bell, Calendar, CheckCircle2, Download, FileText, FileSpreadsheet, Loader2, Pencil, Plus, Receipt, Save, Trash2, Upload, User } from "lucide-react";
import { toast } from "sonner";
import {
  STATUS_LABELS, STATUS_COLORS, STATUS_ORDER, type CommandeStatus,
} from "@/lib/commande-status";
import { setCommandeStatus } from "@/lib/commande-status-update";
import { useServerFn } from "@tanstack/react-start";
import {
  generateDevis, generateBL, generateFacture, appendDtfFromCommande,
} from "@/lib/documents.functions";
import { DtfCard } from "@/components/dtf-card";

export const Route = createFileRoute("/_authenticated/commandes/$id")({
  head: () => ({ meta: [{ title: "Commande — ShapeAndPrint CRM" }] }),
  component: CommandeDetail,
});

type Cmd = {
  id: string; number: string; status: CommandeStatus; description: string | null;
  quantity: number; height_cm: number | null; width_cm: number | null;
  color: string | null; size_label: string | null; unit_price: number | null;
  total_price: number | null; tva_rate: number | null; tva_amount: number | null;
  comment: string | null; created_at: string; created_by: string | null;
  priority: "normal" | "urgent" | null; deadline: string | null;
  avance: number | null; paid: boolean | null;
  discount_rate: number | null;
  client_id: string;
  clients: { full_name: string; phone: string | null; phone2: string | null; company_name: string | null; address: string | null; city: string | null; governorate: string | null; client_type: string | null; brand_name: string | null; contact_origin: string | null; contact_origin_other: string | null } | null;
  order_types: { name: string } | null;
  commande_items?: Array<{
    id: string; position: number; designation: string | null; dimension: string | null;
    quantity: number; unit_price: number | null; total_ht: number | null;
    tva_rate: number | null; tva_amount: number | null; total_ttc: number | null;
    color: string | null; order_type_id: string | null; order_types: { name: string } | null;
  }>;
};
type ItemRow = NonNullable<Cmd["commande_items"]>[number];
type OrderType = { id: string; name: string };
type CmdFile = { id: string; file_name: string; storage_path: string; mime_type: string | null; size_bytes: number | null; commande_item_id: string | null };
type Hist = { id: string; from_status: CommandeStatus | null; to_status: CommandeStatus; created_at: string };

const REMINDER_TARGETS: { value: AppRole | "all"; label: string }[] = [
  { value: "all", label: "Tout le monde" },
  { value: "design", label: ROLE_LABELS.design },
  { value: "production", label: ROLE_LABELS.production },
  { value: "livraison", label: ROLE_LABELS.livraison },
  { value: "marketing", label: ROLE_LABELS.marketing },
];

function CommandeDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, hasRole, hasAnyRole } = useAuth();
  const isAdmin = hasRole("super_admin");
  const canEditCmd = hasAnyRole(["super_admin", "admin", "marketing", "design", "dtf"]);
  const canEditFile = hasAnyRole(["super_admin", "admin", "marketing", "design", "dtf"]);
  const canManageDocuments = hasAnyRole(["super_admin", "admin", "marketing", "design", "dtf"]);
  const canMarkPrete = hasAnyRole(["super_admin", "admin", "production"]);

  const [cmd, setCmd] = useState<Cmd | null>(null);
  const [files, setFiles] = useState<CmdFile[]>([]);
  const [history, setHistory] = useState<Hist[]>([]);
  const [orderTypes, setOrderTypes] = useState<OrderType[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [creator, setCreator] = useState<{ name: string; roles: AppRole[] } | null>(null);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [reminderMsg, setReminderMsg] = useState("");
  const [reminderTarget, setReminderTarget] = useState<string>("all");
  const fileInput = useRef<HTMLInputElement>(null);
  const itemFileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [genLoading, setGenLoading] = useState<null | "devis" | "bl" | "facture" | "dtf">(null);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ description: "", comment: "", priority: "normal" as "normal" | "urgent", deadline: "" });
  const [discountInput, setDiscountInput] = useState<string>("0");
  const [avanceInput, setAvanceInput] = useState<string>("");
  const [savingPay, setSavingPay] = useState(false);
  const [quickDiscount, setQuickDiscount] = useState<string>("0");
  const [savingDiscount, setSavingDiscount] = useState(false);
  const genDevisFn = useServerFn(generateDevis);
  const genBLFn = useServerFn(generateBL);
  const genFacFn = useServerFn(generateFacture);
  const appendDtfFn = useServerFn(appendDtfFromCommande);

  const aggregated = useMemo(() => {
    const ht = items.reduce((s, it) => s + Number(it.total_ht ?? 0), 0);
    const tva = items.reduce((s, it) => s + Number(it.tva_amount ?? 0), 0);
    const rate = Math.max(0, Math.min(100, Number(cmd?.discount_rate ?? 0)));
    const htNet = +(ht * (1 - rate / 100)).toFixed(3);
    const tvaNet = +(tva * (1 - rate / 100)).toFixed(3);
    return {
      ht: +ht.toFixed(3),
      tva: +tva.toFixed(3),
      discountRate: rate,
      discountHt: +(ht - htNet).toFixed(3),
      htNet,
      tvaNet,
      ttc: +(htNet + tvaNet).toFixed(3),
    };
  }, [items, cmd?.discount_rate]);

  const viewGenerated = async (path: string) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 60);
    if (error || !data) { toast.error("Lien indisponible"); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const downloadGenerated = async (path: string, number?: string) => {
    const filename = `${number ?? "document"}.pdf`;
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(path, 60, { download: filename });
    if (error || !data) { toast.error("Lien indisponible"); return; }
    const a = document.createElement("a");
    a.href = data.signedUrl;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const getServerFnHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Session expirée, reconnecte-toi.");
    return { authorization: `Bearer ${session.access_token}` };
  };

  const generate = async (kind: "devis" | "bl" | "facture") => {
    setGenLoading(kind);
    try {
      const fn = kind === "devis" ? genDevisFn : kind === "bl" ? genBLFn : genFacFn;
      const res = await fn({ data: { commandeId: id }, headers: await getServerFnHeaders() });
      const label = kind === "devis" ? "Devis" : kind === "bl" ? "Bon de livraison" : "Facture";
      toast.success(`${label} ${res.number} généré avec succès`, {
        description: "Le document a été enregistré. Vous pouvez le visualiser ou le télécharger.",
        duration: 8000,
        action: { label: "Voir", onClick: () => void viewGenerated(res.path) },
        cancel: { label: "Télécharger", onClick: () => void downloadGenerated(res.path, res.number) },
      });
    } catch (e: any) {
      toast.error("Échec : " + (e?.message ?? "inconnu"));
    } finally { setGenLoading(null); }
  };

  const addToDtf = async () => {
    setGenLoading("dtf");
    try {
      await appendDtfFn({ data: { commandeId: id }, headers: await getServerFnHeaders() });
      toast.success("Ajouté au fichier DTF du client");
    } catch (e: any) {
      toast.error("Échec : " + (e?.message ?? "inconnu"));
    } finally { setGenLoading(null); }
  };

  const load = async () => {
    setLoading(true);
    const [{ data: c }, { data: fs }, { data: h }, { data: ot }] = await Promise.all([
      supabase.from("commandes").select("*, clients(full_name, phone, phone2, company_name, address, city, governorate, client_type, brand_name, contact_origin, contact_origin_other), order_types(name), commande_items(*, order_types(name))").eq("id", id).maybeSingle(),
      supabase.from("commande_files").select("*").eq("commande_id", id).order("created_at", { ascending: false }),
      supabase.from("status_history").select("id, from_status, to_status, created_at").eq("commande_id", id).order("created_at", { ascending: false }),
      supabase.from("order_types").select("id, name").eq("active", true).order("name"),
    ]);
    const commandeRow = c as any;
    setCmd(c ? ({ ...commandeRow, tva_rate: commandeRow.tva_rate ?? 19, tva_amount: commandeRow.tva_amount ?? 0 } as Cmd) : null);
    setFiles((fs as CmdFile[]) ?? []);
    setHistory((h as Hist[]) ?? []);
    setOrderTypes((ot as OrderType[]) ?? []);
    const its = (commandeRow?.commande_items ?? []) as ItemRow[];
    setItems([...its].sort((a, b) => a.position - b.position));
    setAvanceInput(commandeRow?.avance != null ? String(commandeRow.avance) : "");
    setQuickDiscount(String(commandeRow?.discount_rate ?? 0));

    if (commandeRow?.created_by) {
      const [{ data: prof }, { data: urs }] = await Promise.all([
        supabase.from("profiles").select("full_name, email").eq("id", commandeRow.created_by).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", commandeRow.created_by),
      ]);
      const p = prof as { full_name: string | null; email: string | null } | null;
      setCreator({
        name: p?.full_name || p?.email?.split("@")[0] || "—",
        roles: ((urs ?? []) as Array<{ role: AppRole }>).map((r) => r.role),
      });
    } else {
      setCreator(null);
    }
    setLoading(false);
  };
  useEffect(() => { void load(); }, [id]);

  const changeStatus = async (newStatus: CommandeStatus) => {
    const { error } = await setCommandeStatus(id, newStatus);
    if (error) { toast.error("Échec : " + error.message); return; }
    toast.success("Statut mis à jour");
    void load();
  };

  const sendReminder = async () => {
    const { error } = await supabase.from("reminders").insert({
      commande_id: id,
      message: reminderMsg || null,
      target_role: reminderTarget === "all" ? null : (reminderTarget as AppRole),
      created_by: user?.id ?? null,
    });
    if (error) { toast.error("Échec : " + error.message); return; }
    toast.success("Rappel envoyé");
    setReminderMsg("");
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, itemId: string | null = null) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (itemId) setUploadingItemId(itemId); else setUploading(true);
    try {
      const path = `${id}/${Date.now()}-${f.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("commande-files").upload(path, f);
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("commande_files").insert({
        commande_id: id, file_name: f.name, storage_path: path,
        mime_type: f.type || null, size_bytes: f.size, uploaded_by: user?.id ?? null,
        commande_item_id: itemId,
      } as any);
      if (insErr) throw insErr;
      toast.success("Fichier ajouté");
      void load();
    } catch (err: any) {
      toast.error("Échec : " + (err?.message ?? "inconnu"));
    } finally {
      if (itemId) {
        setUploadingItemId(null);
        const el = itemFileInputs.current[itemId];
        if (el) el.value = "";
      } else {
        setUploading(false);
        if (fileInput.current) fileInput.current.value = "";
      }
    }
  };

  const downloadFile = async (cf: CmdFile) => {
    const { data, error } = await supabase.storage.from("commande-files").createSignedUrl(cf.storage_path, 60);
    if (error || !data) { toast.error("Lien indisponible"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const deleteFile = async (cf: CmdFile) => {
    await supabase.storage.from("commande-files").remove([cf.storage_path]);
    await supabase.from("commande_files").delete().eq("id", cf.id);
    toast.success("Fichier supprimé");
    void load();
  };

  const deleteCmd = async () => {
    const { error } = await supabase.from("commandes").delete().eq("id", id);
    if (error) { toast.error("Échec : " + error.message); return; }
    toast.success("Commande supprimée");
    navigate({ to: "/commandes" });
  };

  const openEdit = () => {
    if (!cmd) return;
    setForm({
      description: cmd.description ?? "",
      comment: cmd.comment ?? "",
      priority: (cmd.priority ?? "normal") as "normal" | "urgent",
      deadline: cmd.deadline ? new Date(cmd.deadline).toISOString().slice(0, 16) : "",
    });
    setDiscountInput(String(cmd.discount_rate ?? 0));
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!cmd) return;
    setSaving(true);
    const dr = Math.max(0, Math.min(100, parseFloat((discountInput || "0").replace(",", ".")) || 0));
    const { error } = await supabase.from("commandes").update({
      description: form.description || null,
      comment: form.comment || null,
      priority: form.priority,
      deadline: form.priority === "urgent" && form.deadline ? new Date(form.deadline).toISOString() : null,
      discount_rate: dr,
      ...(form.priority === "normal" ? { overdue_notified_at: null } : {}),
    }).eq("id", id);
    setSaving(false);
    if (error) { toast.error("Échec : " + error.message); return; }
    const ht2 = items.reduce((s, it) => s + Number(it.total_ht ?? 0), 0);
    const tva2 = items.reduce((s, it) => s + Number(it.tva_amount ?? 0), 0);
    await supabase.from("commandes").update({
      total_price: +(ht2 * (1 - dr / 100)).toFixed(3),
      tva_amount: +(tva2 * (1 - dr / 100)).toFixed(3),
    }).eq("id", id);
    toast.success("Commande mise à jour");
    setEditOpen(false);
    void load();
  };

  const updateItemLocal = (itemId: string, patch: Partial<ItemRow>) => {
    setItems((prev) => prev.map((it) => {
      if (it.id !== itemId) return it;
      const next = { ...it, ...patch };
      const qty = Number(next.quantity ?? 1) || 1;
      const unit = next.unit_price == null ? null : Number(next.unit_price);
      const rate = Number(next.tva_rate ?? 19);
      const typeName = (orderTypes.find((t) => t.id === next.order_type_id)?.name
        ?? next.order_types?.name ?? "").toLowerCase();
      const isDtf = typeName.includes("dtf");
      if (unit != null && !Number.isNaN(unit)) {
        if (isDtf) {
          const dim = parseFloat(((next.dimension ?? "") as string).replace(",", "."));
          next.total_ht = Number.isNaN(dim) ? 0 : +(dim * qty * unit).toFixed(3);
        } else {
          next.total_ht = +(qty * unit).toFixed(3);
        }
        next.tva_amount = +(next.total_ht * (rate / 100)).toFixed(3);
        next.total_ttc = +(next.total_ht + next.tva_amount).toFixed(3);
      }
      return next;
    }));
  };

  const recomputeTotals = async () => {
    const ht = items.reduce((s, it) => s + Number(it.total_ht ?? 0), 0);
    const tva = items.reduce((s, it) => s + Number(it.tva_amount ?? 0), 0);
    const rate = items.length ? Number(items[0].tva_rate ?? 19) : 19;
    const dr = Math.max(0, Math.min(100, Number(cmd?.discount_rate ?? 0)));
    await supabase.from("commandes").update({
      total_price: +(ht * (1 - dr / 100)).toFixed(3),
      tva_amount: +(tva * (1 - dr / 100)).toFixed(3),
      tva_rate: rate,
    }).eq("id", id);
  };

  const saveItem = async (it: ItemRow) => {
    setSavingItemId(it.id);
    const typeName = (orderTypes.find((t) => t.id === it.order_type_id)?.name
      ?? it.order_types?.name ?? "").toLowerCase();
    const isDtf = typeName.includes("dtf");
    const dim = parseFloat(String(it.dimension ?? "").replace(",", "."));
    const metrage = isDtf && !Number.isNaN(dim) ? +(dim * Number(it.quantity ?? 1)).toFixed(3) : null;
    const { error } = await supabase.from("commande_items").update({
      designation: it.designation || null,
      dimension: it.dimension || null,
      quantity: it.quantity,
      unit_price: it.unit_price,
      tva_rate: it.tva_rate,
      total_ht: it.total_ht,
      tva_amount: it.tva_amount,
      total_ttc: it.total_ttc,
      color: it.color || null,
      order_type_id: it.order_type_id,
      total_metrage: metrage,
    } as any).eq("id", it.id);
    if (!error) await recomputeTotals();
    setSavingItemId(null);
    if (error) { toast.error("Échec : " + error.message); return; }
    try { await appendDtfFn({ data: { commandeId: id }, headers: await getServerFnHeaders() }); } catch {}
    toast.success("Ligne enregistrée");
    void load();
  };

  const savePayment = async (patch: { avance?: number; paid?: boolean }) => {
    if (!cmd) return;
    setSavingPay(true);
    const payload: any = {};
    if (patch.paid !== undefined) {
      payload.paid = patch.paid;
      if (patch.paid) payload.avance = aggregated.ttc || Number(cmd.total_price ?? 0);
    }
    if (patch.avance !== undefined) payload.avance = Math.round(patch.avance * 1000) / 1000;
    const { error } = await supabase.from("commandes").update(payload).eq("id", id);
    setSavingPay(false);
    if (error) { toast.error("Échec : " + error.message); return; }
    toast.success("Paiement mis à jour");
    void load();
  };

  const addItem = async () => {
    const pos = items.length;
    const defaultType = cmd?.order_types ? orderTypes.find((t) => t.name === cmd.order_types?.name)?.id ?? null : null;
    const { error } = await supabase.from("commande_items").insert({
      commande_id: id, position: pos, quantity: 1, tva_rate: 19,
      order_type_id: defaultType,
    });
    if (error) { toast.error("Échec : " + error.message); return; }
    try { await appendDtfFn({ data: { commandeId: id }, headers: await getServerFnHeaders() }); } catch {}
    void load();
  };

  const removeItem = async (itemId: string) => {
    const { error } = await supabase.from("commande_items").delete().eq("id", itemId);
    if (error) { toast.error("Échec : " + error.message); return; }
    setItems((prev) => prev.filter((it) => it.id !== itemId));
    await recomputeTotals();
    try { await appendDtfFn({ data: { commandeId: id }, headers: await getServerFnHeaders() }); } catch {}
    toast.success("Ligne supprimée");
    void load();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!cmd) return <div><PageHeader title="Commande introuvable" /><Button asChild variant="outline"><Link to="/commandes"><ArrowLeft className="h-4 w-4 mr-2" />Retour</Link></Button></div>;

  return (
    <div>
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link to="/commandes"><ArrowLeft className="h-4 w-4 mr-2" />Retour</Link>
      </Button>

      <PageHeader
        title={cmd.number}
        description={cmd.clients?.full_name ?? undefined}
        actions={
          <div className="flex gap-2">
            <Badge className={STATUS_COLORS[cmd.status]} variant="secondary">{STATUS_LABELS[cmd.status]}</Badge>
            {cmd.priority === "urgent" && (
              <Badge variant="destructive" className="animate-pulse">
                URGENT{cmd.deadline ? ` · ${new Date(cmd.deadline).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}` : ""}
              </Badge>
            )}
            {cmd.paid ? (
              <Badge className="bg-emerald-200 text-emerald-900">Payé</Badge>
            ) : Number(cmd.avance ?? 0) > 0 ? (
              <Badge className="bg-amber-200 text-amber-900">Avance : {Number(cmd.avance).toFixed(3)} DT</Badge>
            ) : (
              <Badge variant="outline">Non payé</Badge>
            )}
            {canEditCmd && (
              <Button variant="outline" size="sm" onClick={openEdit}>
                <Pencil className="h-4 w-4 mr-2" />Modifier
              </Button>
            )}
            {isAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer cette commande ?</AlertDialogTitle>
                    <AlertDialogDescription>Action irréversible.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteCmd}>Supprimer</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        }
      />

      {canMarkPrete && cmd.status !== "prete" && cmd.status !== "livre" && (
        <div className="fixed bottom-4 right-4 z-50 sm:bottom-6 sm:right-6">
          <Button
            size="lg"
            className="shadow-[var(--shadow-elegant)] bg-yellow-400 text-yellow-950 hover:bg-yellow-500"
            onClick={() => void changeStatus("prete")}
          >
            <CheckCircle2 className="h-5 w-5 mr-2" />
            Prêt
          </Button>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          Créée le {new Date(cmd.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
        </span>
        {creator && (
          <span className="inline-flex items-center gap-1">
            <User className="h-3.5 w-3.5" />
            Par <span className="text-foreground font-medium">{creator.name}</span>
            {creator.roles.length > 0 && (
              <span className="font-mono opacity-70">· {creator.roles.map((r) => ROLE_LABELS[r]).join(", ")}</span>
            )}
          </span>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="order-first lg:order-none lg:col-span-2 shadow-[var(--shadow-soft)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Produits ({items.length})</CardTitle>
            {canEditCmd && (
              <Button size="sm" variant="outline" onClick={addItem}><Plus className="h-4 w-4 mr-2" />Ajouter ligne</Button>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-3 text-sm border-b pb-3 mb-2">
              <div>
                <div className="text-xs text-muted-foreground">Client</div>
                {cmd.client_id ? (
                  <Link
                    to="/clients/$clientId"
                    params={{ clientId: cmd.client_id }}
                    className="font-medium text-primary hover:underline"
                  >
                    {cmd.clients?.full_name || "—"}
                  </Link>
                ) : (
                  <div className="font-medium">{cmd.clients?.full_name || "—"}</div>
                )}
              </div>
              <Field label="Type" value={cmd.clients?.client_type ? (cmd.clients.client_type.charAt(0).toUpperCase() + cmd.clients.client_type.slice(1)) : null} />
              <Field label="Téléphone" value={[cmd.clients?.phone, cmd.clients?.phone2].filter(Boolean).join(" · ") || null} />
              <Field label="Société" value={cmd.clients?.company_name} />
              <Field label="Nom de Brand" value={cmd.clients?.brand_name} />
              <Field label="Adresse" value={[cmd.clients?.address, cmd.clients?.city, cmd.clients?.governorate].filter(Boolean).join(", ") || null} />
              <Field label="Origine de contact" value={cmd.clients?.contact_origin ? (cmd.clients.contact_origin === "autre" ? (cmd.clients.contact_origin_other || "autre") : cmd.clients.contact_origin) : null} />
            </div>
            {items.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">Aucune ligne</div>}
            {items.map((it, idx) => (
              <div key={it.id} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-muted-foreground">Ligne {idx + 1}</div>
                  {canEditCmd && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => saveItem(it)} disabled={savingItemId === it.id}>
                        {savingItemId === it.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => removeItem(it.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="col-span-2">
                    <Label className="text-xs">Désignation</Label>
                    <Input value={it.designation ?? ""} disabled={!canEditCmd}
                      onChange={(e) => updateItemLocal(it.id, { designation: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Type</Label>
                    <Select value={it.order_type_id ?? ""} disabled={!canEditCmd}
                      onValueChange={(v) => updateItemLocal(it.id, { order_type_id: v })}>
                      <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        {orderTypes.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    {(() => {
                      const tName = (orderTypes.find((t) => t.id === it.order_type_id)?.name ?? it.order_types?.name ?? "").toLowerCase();
                      const dtf = tName.includes("dtf");
                      return (
                        <>
                          <Label className="text-xs">{dtf ? "Dimension (ML)" : "Taille"}</Label>
                          <Input value={it.dimension ?? ""} disabled={!canEditCmd}
                            placeholder={dtf ? "ex: 1.5" : "ex: 30x40, A3, M, L…"}
                            onChange={(e) => updateItemLocal(it.id, { dimension: e.target.value })} />
                        </>
                      );
                    })()}
                  </div>
                  <div>
                    <Label className="text-xs">Quantité</Label>
                    <Input type="number" value={it.quantity} disabled={!canEditCmd}
                      onChange={(e) => updateItemLocal(it.id, { quantity: parseInt(e.target.value, 10) || 1 })} />
                  </div>
                  <div>
                    <Label className="text-xs">PU (DT)</Label>
                    <Input type="number" step="0.001" value={it.unit_price ?? ""} disabled={!canEditCmd}
                      onChange={(e) => updateItemLocal(it.id, { unit_price: e.target.value === "" ? null : parseFloat(e.target.value) })} />
                  </div>
                  <div>
                    <Label className="text-xs">TVA (%)</Label>
                    <Input type="number" step="0.1" value={it.tva_rate ?? 19} disabled={!canEditCmd}
                      onChange={(e) => updateItemLocal(it.id, { tva_rate: parseFloat(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <Label className="text-xs">Couleur</Label>
                    <Input value={it.color ?? ""} disabled={!canEditCmd}
                      onChange={(e) => updateItemLocal(it.id, { color: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground pt-1">
                  <div>HT : <span className="font-medium text-foreground">{Number(it.total_ht ?? 0).toFixed(3)} DT</span></div>
                  <div>TVA : <span className="font-medium text-foreground">{Number(it.tva_amount ?? 0).toFixed(3)} DT</span></div>
                  <div>TTC : <span className="font-medium text-foreground">{Number(it.total_ttc ?? 0).toFixed(3)} DT</span></div>
                  {(() => {
                    const tName = (orderTypes.find((t) => t.id === it.order_type_id)?.name ?? it.order_types?.name ?? "").toLowerCase();
                    if (!tName.includes("dtf")) return null;
                    const dim = parseFloat(String(it.dimension ?? "").replace(",", "."));
                    const ml = Number.isNaN(dim) ? 0 : +(dim * Number(it.quantity ?? 1)).toFixed(3);
                    return <div>Total Métrage : <span className="font-medium text-foreground">{ml.toFixed(3)} ML</span></div>;
                  })()}
                </div>
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs font-semibold text-muted-foreground">
                      Fichiers ({files.filter((f) => f.commande_item_id === it.id).length})
                    </div>
                    {canEditFile && (
                      <>
                        <input
                          ref={(el) => { itemFileInputs.current[it.id] = el; }}
                          type="file"
                          className="hidden"
                          onChange={(e) => handleUpload(e, it.id)}
                        />
                        <Button size="sm" variant="outline" disabled={uploadingItemId === it.id}
                          onClick={() => itemFileInputs.current[it.id]?.click()}>
                          {uploadingItemId === it.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
                          Ajouter
                        </Button>
                      </>
                    )}
                  </div>
                  <div className="divide-y rounded border">
                    {files.filter((f) => f.commande_item_id === it.id).length === 0 ? (
                      <div className="py-2 text-center text-xs text-muted-foreground">Aucun fichier</div>
                    ) : (
                      files.filter((f) => f.commande_item_id === it.id).map((f) => (
                        <div key={f.id} className="p-2 flex items-center gap-2">
                          <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium truncate">{f.file_name}</div>
                            <div className="text-[10px] text-muted-foreground">{f.size_bytes ? formatSize(f.size_bytes) : ""}</div>
                          </div>
                          <Button variant="ghost" size="sm" onClick={() => downloadFile(f)}><Download className="h-3 w-3" /></Button>
                          {canEditFile && (
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteFile(f)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/40 p-3 text-sm">
              <div><div className="text-xs text-muted-foreground">Total HT</div><div className="font-semibold">{aggregated.ht.toFixed(3)} DT</div></div>
              <div><div className="text-xs text-muted-foreground">TVA</div><div className="font-semibold">{aggregated.tva.toFixed(3)} DT</div></div>
              <div><div className="text-xs text-muted-foreground">Total TTC</div><div className="font-semibold">{aggregated.ttc.toFixed(3)} DT</div></div>
              {aggregated.discountRate > 0 && (
                <>
                  <div><div className="text-xs text-muted-foreground">Remise ({aggregated.discountRate}%)</div><div className="font-semibold text-destructive">-{aggregated.discountHt.toFixed(3)} DT</div></div>
                  <div><div className="text-xs text-muted-foreground">HT net</div><div className="font-semibold">{aggregated.htNet.toFixed(3)} DT</div></div>
                  <div><div className="text-xs text-muted-foreground">TVA net</div><div className="font-semibold">{aggregated.tvaNet.toFixed(3)} DT</div></div>
                </>
              )}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Description</div>
              <div className="whitespace-pre-wrap text-sm">{cmd.description || "—"}</div>
            </div>
            {cmd.comment && (
              <div>
                <div className="text-xs text-muted-foreground">Commentaire</div>
                <div className="whitespace-pre-wrap text-sm">{cmd.comment}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="order-[-1] sticky top-0 z-40 -mx-4 rounded-none border-x-0 bg-card/95 shadow-[var(--shadow-soft)] backdrop-blur supports-[backdrop-filter]:bg-card/85 sm:top-3 sm:mx-0 sm:rounded-lg sm:border-x lg:order-none lg:top-4 lg:h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Statut</CardTitle>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1 text-xs text-muted-foreground">
              <div>
                <span className="block font-mono text-[10px] uppercase text-muted-foreground">Commande</span>
                <span className="font-semibold text-foreground">{cmd.number}</span>
              </div>
              <div>
                <span className="block font-mono text-[10px] uppercase text-muted-foreground">Client</span>
                <span className="line-clamp-1 font-semibold text-foreground">{cmd.clients?.full_name ?? "—"}</span>
              </div>
              <div>
                <span className="block font-mono text-[10px] uppercase text-muted-foreground">Créée</span>
                <span>{new Date(cmd.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</span>
              </div>
              <div>
                <span className="block font-mono text-[10px] uppercase text-muted-foreground">Total</span>
                <span>{aggregated.ttc.toFixed(3)} DT</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={cmd.status} onValueChange={(v) => changeStatus(v as CommandeStatus)} disabled={cmd.status === "livre" && !isAdmin}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_ORDER.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            {cmd.status === "livre" && (
              <p className="text-xs text-muted-foreground">
                Commande livrée et archivée. {isAdmin ? "Seul le super admin peut encore modifier." : "Statut verrouillé."}
              </p>
            )}
            {canEditCmd && (
              <div className="border-t pt-3">
                <div className="text-xs font-semibold mb-2">Envoyer un rappel</div>
                <Select value={reminderTarget} onValueChange={setReminderTarget}>
                  <SelectTrigger className="mb-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REMINDER_TARGETS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Textarea placeholder="Message…" rows={2} value={reminderMsg} onChange={(e) => setReminderMsg(e.target.value)} />
                <Button className="w-full mt-2" size="sm" onClick={sendReminder}><Bell className="h-4 w-4 mr-2" />Notifier</Button>
              </div>
            )}
            {canEditCmd && (
              <div className="border-t pt-3 space-y-2">
                <div className="text-xs font-semibold">Paiement</div>
                <div>
                  <Label className="text-xs">Avance (DT)</Label>
                  <div className="flex gap-2">
                    <Input type="number" step="0.001" value={avanceInput} disabled={!!cmd.paid}
                      onChange={(e) => setAvanceInput(e.target.value)} />
                    <Button size="sm" variant="outline" disabled={savingPay || !!cmd.paid}
                      onClick={() => savePayment({ avance: avanceInput === "" ? 0 : Number(avanceInput) })}>
                      <Save className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <Button size="sm" className="w-full" variant={cmd.paid ? "default" : "outline"}
                  disabled={savingPay}
                  onClick={() => savePayment({ paid: !cmd.paid })}>
                  {cmd.paid ? "✓ Payé en totalité (cliquer pour annuler)" : "Marquer comme payé"}
                </Button>
                <div className="border-t pt-3">
                  <Label className="text-xs">Remise (%)</Label>
                  <div className="flex gap-2">
                    <Input type="number" step="0.01" min={0} max={100} value={quickDiscount}
                      onChange={(e) => setQuickDiscount(e.target.value)} />
                    <Button size="sm" variant="outline" disabled={savingDiscount}
                      onClick={async () => {
                        setSavingDiscount(true);
                        const dr = Math.max(0, Math.min(100, parseFloat((quickDiscount || "0").replace(",", ".")) || 0));
                        const ht2 = items.reduce((s, it) => s + Number(it.total_ht ?? 0), 0);
                        const tva2 = items.reduce((s, it) => s + Number(it.tva_amount ?? 0), 0);
                        const { error } = await supabase.from("commandes").update({
                          discount_rate: dr,
                          total_price: +(ht2 * (1 - dr / 100)).toFixed(3),
                          tva_amount: +(tva2 * (1 - dr / 100)).toFixed(3),
                        }).eq("id", id);
                        setSavingDiscount(false);
                        if (error) { toast.error("Échec : " + error.message); return; }
                        toast.success("Remise mise à jour — pensez à régénérer les documents");
                        void load();
                      }}>
                      {savingDiscount ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Après modification, cliquez sur « Générer Devis / BL / Facture » pour produire les documents avec la nouvelle remise.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {canManageDocuments && (
          <>
            <Card className="lg:col-span-3 shadow-[var(--shadow-soft)]">
              <CardHeader><CardTitle className="text-base">Documents</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => generate("devis")} disabled={genLoading !== null}>
                  {genLoading === "devis" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                  Générer Devis
                </Button>
                <Button size="sm" variant="outline" onClick={() => generate("bl")} disabled={genLoading !== null}>
                  {genLoading === "bl" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                  Générer Bon de Livraison
                </Button>
                <Button size="sm" variant="outline" onClick={() => generate("facture")} disabled={genLoading !== null}>
                  {genLoading === "facture" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Receipt className="h-4 w-4 mr-2" />}
                  Générer Facture
                </Button>
                <Button size="sm" onClick={addToDtf} disabled={genLoading !== null}>
                  {genLoading === "dtf" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
                  Ajouter au fichier client
                </Button>
              </CardContent>
            </Card>

            <DtfCard clientId={cmd.client_id} />
          </>
        )}


        <Card className="lg:col-span-2 shadow-[var(--shadow-soft)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Autres fichiers ({files.filter((f) => !f.commande_item_id).length})</CardTitle>
            {canEditFile && (
              <>
                <input ref={fileInput} type="file" className="hidden" onChange={handleUpload} />
                <Button size="sm" onClick={() => fileInput.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Téléverser
                </Button>
              </>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {files.filter((f) => !f.commande_item_id).length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Aucun fichier</div>
            ) : (
              <div className="divide-y">
                {files.filter((f) => !f.commande_item_id).map((f) => (
                  <div key={f.id} className="p-3 flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{f.file_name}</div>
                      <div className="text-xs text-muted-foreground">{f.size_bytes ? formatSize(f.size_bytes) : ""}</div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => downloadFile(f)}><Download className="h-4 w-4" /></Button>
                    {canEditFile && (
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteFile(f)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-[var(--shadow-soft)] h-fit">
          <CardHeader><CardTitle className="text-base">Historique</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {history.map((h) => (
                <div key={h.id} className="p-3 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    {h.from_status && <Badge variant="outline" className="text-[10px]">{STATUS_LABELS[h.from_status]}</Badge>}
                    <span className="text-muted-foreground">→</span>
                    <Badge className={STATUS_COLORS[h.to_status]} variant="secondary">{STATUS_LABELS[h.to_status]}</Badge>
                  </div>
                  <div className="text-muted-foreground mt-1">{new Date(h.created_at).toLocaleString("fr-FR")}</div>
                </div>
              ))}
              {history.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">—</div>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Modifier description / commentaire</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Description</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label>Commentaire</Label>
              <Textarea rows={3} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Priorité</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as "normal" | "urgent" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.priority === "urgent" && (
                <div>
                  <Label>Date limite</Label>
                  <Input type="datetime-local" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
                </div>
              )}
            </div>
            <div>
              <Label>Remise (%)</Label>
              <Input type="number" step="0.01" min={0} max={100} value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)} placeholder="0" />
            </div>
            <div className="text-xs text-muted-foreground">Pour modifier les lignes produit, utilise le tableau « Produits ».</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value || "—"}</div>
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}
