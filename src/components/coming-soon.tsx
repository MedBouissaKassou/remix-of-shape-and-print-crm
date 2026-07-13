import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export function ComingSoon({ title, description, phase }: { title: string; description?: string; phase?: string }) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <Card className="shadow-[var(--shadow-soft)]">
        <CardContent className="py-12 flex flex-col items-center text-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-accent-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Bientôt disponible</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Cette section sera livrée {phase ? `en ${phase}` : "prochainement"}.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}