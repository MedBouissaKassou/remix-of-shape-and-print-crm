import { supabase } from "@/integrations/supabase/client";
import { STATUS_ORDER, type CommandeStatus } from "@/lib/commande-status";

const VALID_STATUSES = new Set<CommandeStatus>(STATUS_ORDER);

export async function setCommandeStatus(commandeId: string, status: CommandeStatus) {
  if (!VALID_STATUSES.has(status)) {
    return {
      data: null,
      error: new Error(`Statut de commande invalide: ${status}`),
    };
  }

  return supabase
    .from("commandes")
    .update({ status })
    .eq("id", commandeId)
    .select("id, status")
        .single();

}