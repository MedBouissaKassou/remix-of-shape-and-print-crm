import { createFileRoute } from "@tanstack/react-router";
import { DocumentsList } from "@/components/documents-list";
export const Route = createFileRoute("/_authenticated/bons-livraison")({
  head: () => ({ meta: [{ title: "Bons de livraison — ShapeAndPrint CRM" }] }),
  component: () => <DocumentsList kind="bl" title="Bons de livraison" />,
});