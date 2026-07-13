import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, ROLE_LABELS, type AppRole } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, RefreshCcw, Paperclip, Download, Bell } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/todo")({
  head: () => ({ meta: [{ title: "To Do List — ShapeAndPrint CRM" }] }),
  component: TodoPage,
});

type TicketStatus = "todo" | "in_progress" | "done";

type Ticket = {
  id: string;
  name: string;
  description: string | null;
  status: TicketStatus;
  created_by: string | null;
  created_by_role: AppRole | null;
  assigned_role: AppRole;
  created_at: string;
  updated_at: string;
  attachment_path: string | null;
  attachment_name: string | null;
  notify_roles: AppRole[] | null;
};

const STATUSES: { value: TicketStatus; label: string; cls: string }[] = [
  { value: "todo", label: "To do", cls: "bg-slate-200 text-slate-800" },
  { value: "in_progress", label: "En cours", cls: "bg-blue-200 text-blue-900" },
  { value: "done", label: "Terminé", cls: "bg-emerald-200 text-emerald-900" },
];

const DEPARTMENTS: AppRole[] = ["marketing", "design", "production", "livraison", "dtf", "admin", "super_admin"];

function statusMeta(s: TicketStatus) {
  return STATUSES.find((x) => x.value === s)!;
}

function TodoPage() {
  const { user, roles, hasAnyRole } = useAuth();
  const isAdmin = hasAnyRole(["super_admin", "admin"]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "mine">("all");

  // form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [assignedRole, setAssignedRole] = useState<AppRole | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [notifying, setNotifying] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tickets")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setTickets((data ?? []) as Ticket[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const canEditTicket = (t: Ticket) => isAdmin || (!!user && t.created_by === user.id);
  const canChangeStatus = (t: Ticket) =>
    isAdmin || (!!user && t.created_by === user.id) || roles.includes(t.assigned_role);

  const createTicket = async () => {
    if (!name.trim() || !assignedRole) {
      toast.error("Nom et département requis");
      return;
    }
    setSubmitting(true);
    const myRole: AppRole | null = roles[0] ?? null;
    let attachment_path: string | null = null;
    let attachment_name: string | null = null;
    if (file) {
      const path = `${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("ticket-files").upload(path, file);
      if (upErr) { setSubmitting(false); toast.error(upErr.message); return; }
      attachment_path = path;
      attachment_name = file.name;
    }
    const { error } = await supabase.from("tickets").insert({
      name: name.trim(),
      description: description.trim() || null,
      assigned_role: assignedRole,
      created_by: user?.id ?? null,
      created_by_role: myRole,
      status: "todo",
      attachment_path,
      attachment_name,
      notify_roles: [assignedRole],
    } as any);
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Ticket créé");
    setName(""); setDescription(""); setAssignedRole(""); setFile(null);
    setOpen(false);
    void load();
  };

  const updateStatus = async (t: Ticket, status: TicketStatus) => {
    const { error } = await supabase.from("tickets").update({ status }).eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    setTickets((prev) => prev.map((x) => (x.id === t.id ? { ...x, status } : x)));
  };

  const updateField = async (t: Ticket, patch: Partial<Ticket>) => {
    const { error } = await supabase.from("tickets").update(patch).eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    setTickets((prev) => prev.map((x) => (x.id === t.id ? { ...x, ...patch } : x)));
    toast.success("Ticket mis à jour");
  };

  const deleteTicket = async (t: Ticket) => {
    if (!confirm(`Supprimer le ticket "${t.name}" ?`)) return;
    const { error } = await supabase.from("tickets").delete().eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    setTickets((prev) => prev.filter((x) => x.id !== t.id));
  };

  const downloadAttachment = async (t: Ticket) => {
    if (!t.attachment_path) return;
    const { data, error } = await supabase.storage.from("ticket-files").createSignedUrl(t.attachment_path, 60);
    if (error || !data) { toast.error("Lien indisponible"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const notifyTicket = async (t: Ticket) => {
    setNotifying(t.id);
    const { data: targets, error: rerr } = await supabase
      .from("user_roles").select("user_id").eq("role", t.assigned_role);
    if (rerr) { setNotifying(null); toast.error(rerr.message); return; }
    const recipients = (targets ?? [])
      .map((r) => r.user_id)
      .filter((uid) => !user?.id || uid !== user.id);
    if (recipients.length === 0) {
      setNotifying(null);
      toast.info("Aucun destinataire pour ce département");
      return;
    }
    const rows = recipients.map((uid) => ({
      user_id: uid,
      title: "Rappel ticket",
      body: `Ticket: ${t.name}`,
      link: "/todo",
    }));
    const { error } = await supabase.from("notifications").insert(rows);
    setNotifying(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Notifié ${ROLE_LABELS[t.assigned_role]} (${recipients.length})`);
  };

  const visible = isAdmin
    ? (filter === "all" ? tickets : tickets.filter((t) => roles.includes(t.assigned_role)))
    : tickets.filter((t) => roles.includes(t.assigned_role) || (!!user && t.created_by === user.id));

  const grouped = DEPARTMENTS.map((dep) => ({
    dep,
    items: visible.filter((t) => t.assigned_role === dep),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Collaboration"
        title="To-Do List"
        description="Tickets de tâches par département"
        helper="Créez un ticket pour assigner une tâche à un département (Marketing, Design, Production, Livraison, DTF). Le département concerné sera notifié et pourra suivre son avancement."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()}>
              <RefreshCcw className="h-4 w-4" /> Actualiser
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4" /> Nouveau ticket</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Nouveau ticket</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Nom</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
                  </div>
                  <div>
                    <Label>Affecter à</Label>
                    <Select value={assignedRole} onValueChange={(v) => setAssignedRole(v as AppRole)}>
                      <SelectTrigger><SelectValue placeholder="Choisir un département" /></SelectTrigger>
                      <SelectContent>
                        {DEPARTMENTS.map((d) => (
                          <SelectItem key={d} value={d}>{ROLE_LABELS[d]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Pièce jointe (optionnel)</Label>
                    <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                    {file && <div className="text-xs text-muted-foreground mt-1">{file.name}</div>}
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                  <Button onClick={createTicket} disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Créer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      {isAdmin && (
        <div className="flex gap-2">
          <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
            Tous les départements
          </Button>
          <Button variant={filter === "mine" ? "default" : "outline"} size="sm" onClick={() => setFilter("mine")}>
            Mes tickets affectés
          </Button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Chargement…</div>
      ) : grouped.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Aucun ticket</CardContent></Card>
      ) : (
        grouped.map((g) => (
          <div key={g.dep} className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {ROLE_LABELS[g.dep]} <span className="text-xs">({g.items.length})</span>
            </h3>
            <div className="grid gap-2">
              {g.items.map((t) => {
                const meta = statusMeta(t.status);
                return (
                  <Card key={t.id}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {canEditTicket(t) ? (
                            <Input
                              className="font-semibold"
                              defaultValue={t.name}
                              onBlur={(e) => { if (e.target.value !== t.name) void updateField(t, { name: e.target.value }); }}
                            />
                          ) : (
                            <div className="font-semibold">{t.name}</div>
                          )}
                          {canEditTicket(t) ? (
                            <Textarea
                              className="mt-2"
                              defaultValue={t.description ?? ""}
                              rows={2}
                              onBlur={(e) => { if ((e.target.value || null) !== t.description) void updateField(t, { description: e.target.value || null }); }}
                            />
                          ) : (
                            t.description && <div className="text-sm text-muted-foreground whitespace-pre-wrap">{t.description}</div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <Badge className={meta.cls}>{meta.label}</Badge>
                          {t.attachment_path && (
                            <Button size="sm" variant="ghost" onClick={() => void downloadAttachment(t)} title={t.attachment_name ?? "Pièce jointe"}>
                              <Paperclip className="h-4 w-4 mr-1" /><Download className="h-3 w-3" />
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => void notifyTicket(t)} disabled={notifying === t.id} title={`Notifier ${ROLE_LABELS[t.assigned_role]}`}>
                            <Bell className="h-4 w-4 mr-1" /> Notifier
                          </Button>
                          {canEditTicket(t) && (
                            <Button size="icon" variant="ghost" onClick={() => void deleteTicket(t)} title="Supprimer">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
                        <span className="text-xs text-muted-foreground">Statut:</span>
                        <Select
                          value={t.status}
                          onValueChange={(v) => void updateStatus(t, v as TicketStatus)}
                          disabled={!canChangeStatus(t)}
                        >
                          <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        {canEditTicket(t) && (
                          <>
                            <span className="text-xs text-muted-foreground ml-2">Département:</span>
                            <Select value={t.assigned_role} onValueChange={(v) => void updateField(t, { assigned_role: v as AppRole })}>
                              <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {DEPARTMENTS.map((d) => <SelectItem key={d} value={d}>{ROLE_LABELS[d]}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </>
                        )}
                        <span className="ml-auto text-xs text-muted-foreground">
                          Créé par {t.created_by_role ? ROLE_LABELS[t.created_by_role] : "—"} · {new Date(t.created_at).toLocaleString("fr-FR")}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}