import { createFileRoute } from "@tanstack/react-router";
import { ClientRegisterPage } from "@/components/auth/ClientRegisterPage";

export const Route = createFileRoute("/client-register")({ ssr: false, component: ClientRegisterPage });
