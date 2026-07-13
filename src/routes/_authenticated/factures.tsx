import { createFileRoute } from "@tanstack/react-router";
import { DocumentsList } from "@/components/documents-list";
export const Route = createFileRoute("/_authenticated/factures")({
  head: () => ({ meta: [{ title: "Factures — ShapeAndPrint CRM" }] }),
  component: () => <DocumentsList kind="facture" title="Factures" />,
});