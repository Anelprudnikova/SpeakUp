import { createFileRoute } from "@tanstack/react-router";
import RequestsList from "@/components/RequestsList";

export const Route = createFileRoute("/_authed/requests/")({
  head: () => ({ meta: [{ title: "SpeakUp — Мои обращения" }] }),
  component: RequestsPage,
});

// Everyone, whatever the role, sees here only the requests they created themselves.
function RequestsPage() {
  return <RequestsList scope="mine" headingKey="nav.myRequests" subKey="list.mineSub" />;
}
