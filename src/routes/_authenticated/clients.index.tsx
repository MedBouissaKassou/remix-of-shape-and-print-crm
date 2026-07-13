import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ClientForm, type ClientFormValues } from "@/components/client-form";
import { Building2, Loader2, Phone, Plus, Search, User2 } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Client = Database["public"]["Tables"]["clients"]["Row"];

export const Route = createFileRoute("/_authenticated/clients/")({
  head: () => ({ meta: [{ title: "Clients — ShapeAndPrint CRM" }] }),
  component: ClientsList,
});

function ClientsList() {
  const { user, hasAnyRole } = useAuth();
  const canEdit = hasAnyRole(["super_admin", "admin", "marketing", "design", "dtf"]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Échec du chargement : " + error.message);
    setClients(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    const channel = supabase
      .channel("clients-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      [c.full_name, c.phone, c.phone2, c.email, c.company_name, c.brand_name, c.city]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q)),
    );
  }, [clients, search]);

  const handleCreate = async (values: ClientFormValues) => {
    const payload = {
      ...values,
      company_name: values.client_type === "entreprise" ? values.company_name || null : null,
      tax_id: values.client_type === "entreprise" ? values.tax_id || null : null,
      brand_name: values.client_type === "particulier" ? values.brand_name || null : null,
      contact_origin: values.contact_origin || null,
      contact_origin_other: values.contact_origin === "autre" ? (values.contact_origin_other || null) : null,
      created_by: user?.id ?? null,
    };
    const { error } = await supabase.from("clients").insert(payload);
    if (error) {
      toast.error("Échec : " + error.message);
      return;
    }
    toast.success("Client créé");
    setOpen(false);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Carnet d'adresses"
        title="Clients"
        description={`${clients.length} client${clients.length > 1 ? "s" : ""} enregistré${clients.length > 1 ? "s" : ""}`}
        helper="Consultez la fiche complète d'un client (coordonnées, fichiers, historique DTF, commandes) en cliquant sur sa carte. Utilisez la recherche pour filtrer rapidement."
        actions={
          canEdit && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="shadow-[var(--shadow-glow)]"><Plus className="h-4 w-4 mr-2" />Nouveau client</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Nouveau client</DialogTitle></DialogHeader>
                <ClientForm onSubmit={handleCreate} onCancel={() => setOpen(false)} submitLabel="Créer" />
              </DialogContent>
            </Dialog>
          )
        }
      />

      <Card className="shadow-[var(--shadow-soft)] mb-6 border-border/60">
        <CardContent className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par nom, téléphone, email, entreprise, brand ou ville…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background/60"
            />
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="py-16 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="shadow-[var(--shadow-soft)] border-dashed">
          <CardContent className="py-16 text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
            <User2 className="h-10 w-10 opacity-30" />
            <div className="font-medium text-foreground">Aucun client</div>
            <p className="max-w-sm">{search ? "Aucun résultat ne correspond à votre recherche." : "Commencez par ajouter votre premier client."}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((c) => {
            const isCompany = c.client_type === "entreprise";
            const Icon = isCompany ? Building2 : User2;
            return (
              <Link
                key={c.id}
                to="/clients/$clientId"
                params={{ clientId: c.id }}
                className="group focus:outline-none"
              >
                <Card className="h-full border-border/60 bg-card/80 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)] hover:border-primary/40">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${isCompany ? "bg-info/15 text-info" : "bg-primary/15 text-primary"}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{c.full_name}</div>
                        {c.company_name && (
                          <div className="text-xs text-muted-foreground truncate">{c.company_name}</div>
                        )}
                        <Badge variant="secondary" className="mt-1.5 text-[10px] uppercase font-mono">
                          {isCompany ? "Entreprise" : "Particulier"}
                        </Badge>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-muted-foreground border-t border-border/60 pt-3">
                      {c.phone && (
                        <div className="flex items-center gap-1.5 truncate">
                          <Phone className="h-3 w-3 shrink-0" />{c.phone}
                        </div>
                      )}
                      {(c.city || c.email) && (
                        <div className="truncate">{[c.city, c.email].filter(Boolean).join(" · ")}</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}