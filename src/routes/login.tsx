import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Printer } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Connexion — ShapeAndPrint CRM" }] }),
  component: LoginPage,
});

const EMAIL_DOMAIN = "shapeandprint.local";
const usernameToEmail = (u: string) => `${u.toLowerCase()}@${EMAIL_DOMAIN}`;

const schema = z.object({
  username: z.string().trim().min(1, "Identifiant requis").max(50),
  password: z.string().trim().min(1, "Mot de passe requis").max(128),
});

function LoginPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/tableau-de-bord", replace: true });
  }, [user, loading, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ username, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    try {
      const email = usernameToEmail(parsed.data.username.trim());
      const { error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });
      if (error) {
        setSubmitting(false);
        toast.error("Identifiants incorrects");
        return;
      }
    } catch (err) {
      setSubmitting(false);
      const msg = err instanceof Error ? err.message : "Identifiants incorrects";
      toast.error(msg);
      return;
    }
    setSubmitting(false);
    toast.success("Bienvenue !");
    navigate({ to: "/tableau-de-bord", replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/30 px-4">
      <Card className="w-full max-w-md shadow-[var(--shadow-elegant)]">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto h-12 w-12 rounded-xl bg-[var(--gradient-primary)] flex items-center justify-center text-primary-foreground">
            <Printer className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">ShapeAndPrint CRM</CardTitle>
          <CardDescription>Connectez-vous à votre espace</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Identifiant</Label>
              <Input id="username" type="text" autoComplete="username" value={username}
                onChange={(e) => setUsername(e.target.value)} required autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" type="password" autoComplete="current-password" value={password}
                onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Se connecter
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Accès réservé. Contactez le Super Admin pour vos identifiants.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}