import { createFileRoute, redirect } from "@tanstack/react-router";
import { AuthGateError, requireSignedIn } from "@/components/auth/AuthGate";
import ClientShell from "@/components/client/ClientShell";

// Clients get their own cabinet; a staff account that lands here goes back to the app.
async function requireClient({ context, location }) {
  const { user } = await requireSignedIn({ context, location });
  if (user.account_type !== "client") throw redirect({ to: "/" });
  return { user };
}

export const Route = createFileRoute("/client")({
  ssr: false,
  beforeLoad: requireClient,
  errorComponent: AuthGateError,
  component: ClientShell,
});
