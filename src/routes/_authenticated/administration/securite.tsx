import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { updateUserCredentials } from "@/lib/admin.functions";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldAlert, Save } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/administration/securite")({
  head: () => ({ meta: [{ title: "Sécurité — ShapeAndPrint CRM" }] }),
  component: SecuritePage,
});

const EMAIL_DOMAIN = "shapeandprint.local";

type Row = { id: string; full_name: string | null; email: string | null };

function SecuritePage() {
  const { hasRole } = useAuth();
  const isSuper = hasRole("super_admin");
  const updateCreds = useServerFn(updateUserCredentials);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, { username: string; password: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("profiles").select("id, full_name, email").order("created_at", { ascending: false });
    setRows((data ?? []) as Row[]);
    setLoading(false);
  };
  useEffect(() => { if (isSuper) void load(); }, [isSuper]);

  if (!isSuper) {
    return (
      <div>
        <PageHeader title="Sécurité" />
        <Card><CardContent className="py-10 flex items-center gap-3 text-sm">
          <ShieldAlert className="h-5 w-5 text-destructive" /> Accès réservé aux Super Admins.
        </CardContent></Card>
      </div>
    );
  }

  const usernameFromEmail = (email: string | null) =>
    email && email.endsWith(`@${EMAIL_DOMAIN}`) ? email.slice(0, -1 - EMAIL_DOMAIN.length) : (email ?? "");

  const onSave = async (r: Row) => {
    const d = drafts[r.id] ?? { username: "", password: "" };
    const username = d.username.trim();
    const password = d.password;
    const currentUser = usernameFromEmail(r.email);
    const payload: { userId: string; username?: string; password?: string } = { userId: r.id };
    if (username && username !== currentUser) payload.username = username;
    if (password) payload.password = password;
    if (!payload.username && !payload.password) { toast.info("Aucun changement"); return; }
    setSaving(r.id);
    try {
      await updateCreds({ data: payload });
      toast.success("Identifiants mis à jour");
      setDrafts((p) => ({ ...p, [r.id]: { username: "", password: "" } }));
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Échec");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Sécurité"
        description="Modifier les identifiants de connexion par utilisateur"
        helper="Réservé aux Super Admins. Réinitialisez un mot de passe ou changez l'email de connexion d'un utilisateur. Communiquez le nouveau mot de passe à l'utilisateur via un canal sécurisé."
      />
      <Card><CardContent className="p-0">
        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="divide-y">
            {rows.map((r) => {
              const current = usernameFromEmail(r.email);
              const d = drafts[r.id] ?? { username: "", password: "" };
              return (
                <div key={r.id} className="p-4 grid md:grid-cols-[1.2fr_1fr_1fr_auto] gap-3 items-end">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.full_name || "Sans nom"}</div>
                    <div className="text-xs text-muted-foreground truncate">Login actuel : <span className="font-mono">{current || "—"}</span></div>
                  </div>
                  <div>
                    <Label className="text-xs">Nouveau login</Label>
                    <Input value={d.username} placeholder={current} onChange={(e) => setDrafts((p) => ({ ...p, [r.id]: { ...d, username: e.target.value } }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Nouveau mot de passe</Label>
                    <Input type="password" value={d.password} placeholder="••••••" onChange={(e) => setDrafts((p) => ({ ...p, [r.id]: { ...d, password: e.target.value } }))} />
                  </div>
                  <Button size="sm" onClick={() => void onSave(r)} disabled={saving === r.id}>
                    {saving === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent></Card>
    </div>
  );
}