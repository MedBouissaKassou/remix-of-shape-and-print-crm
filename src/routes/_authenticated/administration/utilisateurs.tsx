import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, ROLE_LABELS, type AppRole } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, X, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/administration/utilisateurs")({
  head: () => ({ meta: [{ title: "Utilisateurs — ShapeAndPrint CRM" }] }),
  component: UsersAdmin,
});

const ALL_ROLES: AppRole[] = ["super_admin", "marketing", "design", "production", "livraison"];

type Row = { id: string; full_name: string | null; email: string | null; roles: AppRole[] };

function UsersAdmin() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("super_admin");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<Record<string, AppRole | "">>({});

  const load = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").order("created_at", { ascending: false });
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const roleMap = new Map<string, AppRole[]>();
    (roles ?? []).forEach((r) => {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role as AppRole);
      roleMap.set(r.user_id, arr);
    });
    setRows((profiles ?? []).map((p) => ({ ...p, roles: roleMap.get(p.id) ?? [] })));
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const addRole = async (userId: string, role: AppRole) => {
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
    if (error) toast.error("Échec : " + error.message);
    else { toast.success("Rôle ajouté"); setAdding((a) => ({ ...a, [userId]: "" })); void load(); }
  };

  const removeRole = async (userId: string, role: AppRole) => {
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role);
    if (error) toast.error("Échec : " + error.message);
    else { toast.success("Rôle retiré"); void load(); }
  };

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Utilisateurs" />
        <Card><CardContent className="py-10 flex items-center gap-3 text-sm">
          <ShieldAlert className="h-5 w-5 text-destructive" /> Accès réservé aux Super Admins.
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Administration"
        title="Utilisateurs &amp; rôles"
        description="Attribuer ou retirer des rôles aux membres de l'équipe"
        helper="Chaque rôle détermine ce que l'utilisateur peut voir et modifier. Un utilisateur peut cumuler plusieurs rôles. Le rôle Super Admin donne accès à tout."
      />
      <Card className="shadow-[var(--shadow-soft)]">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="divide-y">
              {rows.map((r) => (
                <div key={r.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{r.full_name || "Sans nom"}</div>
                    <div className="text-xs text-muted-foreground truncate">{r.email}</div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {r.roles.map((role) => (
                      <Badge key={role} variant="secondary" className="gap-1">
                        {ROLE_LABELS[role]}
                        <button onClick={() => removeRole(r.id, role)} className="hover:text-destructive" aria-label="Retirer">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    {!r.roles.length && <span className="text-xs text-muted-foreground">Aucun rôle</span>}
                  </div>
                  <div className="flex gap-2 items-center">
                    <Select
                      value={adding[r.id] || ""}
                      onValueChange={(v) => setAdding((a) => ({ ...a, [r.id]: v as AppRole }))}
                    >
                      <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Ajouter un rôle" /></SelectTrigger>
                      <SelectContent>
                        {ALL_ROLES.filter((ro) => !r.roles.includes(ro)).map((ro) => (
                          <SelectItem key={ro} value={ro}>{ROLE_LABELS[ro]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" disabled={!adding[r.id]}
                      onClick={() => adding[r.id] && addRole(r.id, adding[r.id] as AppRole)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}