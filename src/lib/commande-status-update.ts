import { supabase } from "@/integrations/supabase/client";
import type { CommandeStatus } from "@/lib/commande-status";

export async function setCommandeStatus(commandeId: string, status: CommandeStatus) {
  return supabase.rpc("set_commande_status", {
    _commande_id: commandeId,
    _status: status,
  });
}