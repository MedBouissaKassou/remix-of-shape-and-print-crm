import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_authenticated/messenger")({
  head: () => ({ meta: [{ title: "Messenger — ShapeAndPrint CRM" }] }),
  component: () => <ComingSoon title="Messenger Center" description="Intégration Facebook Messenger" phase="une phase ultérieure" />,
});