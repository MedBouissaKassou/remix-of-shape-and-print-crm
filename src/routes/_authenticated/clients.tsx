import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/clients")({
  head: () => ({ meta: [{ title: "Clients — ShapeAndPrint CRM" }] }),
  component: () => <Outlet />,
});