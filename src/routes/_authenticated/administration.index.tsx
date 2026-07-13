import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Lock, Activity } from "lucide-react";
export const Route = createFileRoute("/_authenticated/administration/")({
  head: () => ({ meta: [{ title: "Administration — ShapeAndPrint CRM" }] }),
  component: AdminIndex,
});
function AdminIndex() {
  return (
    <div>
      <PageHeader
        eyebrow="Paramètres"
        title="Administration"
        description="Gestion de la plateforme"
        helper="Réservé aux Super Admins. Gérez les utilisateurs, leurs rôles, et la sécurité des comptes (identifiants, mots de passe)."
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link to="/administration/utilisateurs">
          <Card className="hover:shadow-[var(--shadow-elegant)] transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center gap-3 space-y-0">
              <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center"><Users className="h-5 w-5 text-accent-foreground" /></div>
              <CardTitle className="text-base">Utilisateurs & rôles</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Gérer les utilisateurs et leurs permissions</CardContent>
          </Card>
        </Link>
        <Link to="/administration/securite">
          <Card className="hover:shadow-[var(--shadow-elegant)] transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center gap-3 space-y-0">
              <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center"><Lock className="h-5 w-5 text-accent-foreground" /></div>
              <CardTitle className="text-base">Sécurité</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Modifier les identifiants (login / mot de passe)</CardContent>
          </Card>
        </Link>
        <Link to="/administration/disponibilite">
          <Card className="hover:shadow-[var(--shadow-elegant)] transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center gap-3 space-y-0">
              <div className="h-10 w-10 rounded-lg bg-accent flex items-center justify-center"><Activity className="h-5 w-5 text-accent-foreground" /></div>
              <CardTitle className="text-base">Disponibilité</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Voir quels départements sont actifs en temps réel</CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}