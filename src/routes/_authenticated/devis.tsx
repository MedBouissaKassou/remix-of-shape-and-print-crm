import { createFileRoute } from "@tanstack/react-router";
import { DocumentsList } from "@/components/documents-list";
export const Route = createFileRoute("/_authenticated/devis")({
  head: () => ({ meta: [{ title: "Devis — ShapeAndPrint CRM" }] }),
  component: () => <DocumentsList kind="devis" title="Devis" />,
});