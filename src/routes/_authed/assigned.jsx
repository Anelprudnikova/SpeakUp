import { createFileRoute } from "@tanstack/react-router";
import RequestsList from "@/components/RequestsList";
import ManagerAssignedQueue from "@/components/client/ManagerAssignedQueue";
import { useAuth } from "@/lib/AuthContext";
import { getStaffRole } from "@/lib/roles";

export const Route = createFileRoute("/_authed/assigned")({
  head: () => ({ meta: [{ title: "SpeakUp — Обращения" }] }),
  component: AssignedPage,
});

// One tab for every role: the employee's own assignments, the head's department
// queue and every request for the administrator. A client manager who runs a
// department also works his department queue, so both lists are shown to him.
function AssignedPage() {
  const { user } = useAuth();
  const role = getStaffRole(user);
  const isAdmin = role === "admin";

  return (
    <div className="space-y-7">
      <RequestsList
        scope="assigned"
        // The administrator reads the whole register of the company under its own name.
        headingKey={isAdmin ? "nav.allRequests" : "nav.assigned"}
        subKey={isAdmin ? "attention.allRequestsSub" : "attention.assignedSub"}
        limit={isAdmin ? 300 : undefined}
        showCreate={false}
      />
      {role === "client_manager" ? <ManagerAssignedQueue showHeader={false} /> : null}
    </div>
  );
}
