import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/commandes")({
  head: () => ({ meta: [{ title: "Commandes — ShapeAndPrint CRM" }] }),
  component: () => <Outlet />,
});