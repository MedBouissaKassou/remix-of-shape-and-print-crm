import type { Database } from "@/integrations/supabase/types";

export type CommandeStatus = Database["public"]["Enums"]["commande_status"];

export const STATUS_ORDER: CommandeStatus[] = [
  "non_traite",
  "en_conception",
  "en_production",
  "impression",
  "prete",
  "a_livrer",
  "livre_societe",
  "ramasse_livreur",
  "livre",
];

export const STATUS_LABELS: Record<CommandeStatus, string> = {
  non_traite: "Non traité",
  en_conception: "En conception",
  en_production: "En production",
  impression: "Impression",
  prete: "Prête",
  a_livrer: "À livrer",
  livre_societe: "À livrer avec société de livraison",
  ramasse_livreur: "Ramassé livreur",
  livre: "Livré",
};

export const STATUS_COLORS: Record<CommandeStatus, string> = {
  non_traite: "bg-red-500/20 text-red-700 dark:text-red-300",
  en_conception: "bg-purple-500/20 text-purple-800 dark:text-purple-200",
  en_production: "bg-sky-400/25 text-sky-800 dark:text-sky-200",
  impression: "bg-blue-600/20 text-blue-800 dark:text-blue-200",
  prete: "bg-yellow-400/30 text-yellow-800 dark:text-yellow-200",
  a_livrer: "bg-gray-400/30 text-gray-800 dark:text-gray-200",
  livre_societe: "bg-gray-400/30 text-gray-800 dark:text-gray-200",
  ramasse_livreur: "bg-white text-gray-900 border border-gray-300",
  livre: "bg-emerald-500/25 text-emerald-800 dark:text-emerald-200",
};

// Row-level tints for the commandes list, applied as a left border + subtle bg.
export const STATUS_ROW_TINT: Record<CommandeStatus, string> = {
  non_traite: "border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-950/30",
  en_conception: "border-l-4 border-l-purple-500 bg-purple-50/50 dark:bg-purple-950/30",
  en_production: "border-l-4 border-l-sky-400 bg-sky-50/50 dark:bg-sky-950/30",
  impression: "border-l-4 border-l-blue-600 bg-blue-50/50 dark:bg-blue-950/30",
  prete: "border-l-4 border-l-yellow-400 bg-yellow-50/60 dark:bg-yellow-950/30",
  a_livrer: "border-l-4 border-l-gray-400 bg-gray-100/60 dark:bg-gray-800/30",
  livre_societe: "border-l-4 border-l-gray-400 bg-gray-100/60 dark:bg-gray-800/30",
  ramasse_livreur: "border-l-4 border-l-gray-300 bg-white dark:bg-gray-950",
  livre: "border-l-4 border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30",
};
