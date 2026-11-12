import { createFileRoute } from "@tanstack/react-router";
import RequestsList from "@/components/RequestsList";

export const Route = createFileRoute("/_authed/overdue")({
  head: () => ({ meta: [{ title: "SpeakUp — Просроченные" }] }),
  component: OverduePage,
});

function OverduePage() {
  return <RequestsList scope="overdue" headingKey="nav.overdue" subKey="overdue.sub" showCreate={false} />;
}
