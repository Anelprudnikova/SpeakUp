import { createFileRoute } from "@tanstack/react-router";
import RequestsList from "@/components/RequestsList";

export const Route = createFileRoute("/_authed/review")({
  head: () => ({ meta: [{ title: "SpeakUp — Проверка руководителя" }] }),
  component: ReviewPage,
});

// Work the employees submitted for verification waits here for the head
// of the department: he accepts the result, returns it for rework or rejects it.
function ReviewPage() {
  return <RequestsList scope="review" headingKey="nav.review" subKey="review.sub" showCreate={false} />;
}
