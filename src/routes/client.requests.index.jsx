import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Loader2 } from "lucide-react";
import ClientStatusBadge from "@/components/client/ClientStatusBadge";
import { listMyClientRequests } from "@/lib/client-fns";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/roles";

export const Route = createFileRoute("/client/requests/")({
  head: () => ({ meta: [{ title: "SpeakUp — Мои обращения" }] }),
  component: ClientRequestsPage,
});

function ClientRequestsPage() {
  const { t, lang } = useI18n();
  const fetchRequests = useServerFn(listMyClientRequests);
  const { data, isLoading } = useQuery({ queryKey: ["client-requests"], queryFn: () => fetchRequests() });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-heading text-2xl font-bold text-navy sm:text-3xl">{t("client.myHeading")}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t("client.mySub")}</p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.loading")}
        </div>
      ) : data?.items?.length ? (
        <div className="space-y-2.5">
          {data.items.map((item) => (
            <Link
              key={item.id}
              to="/client/requests/$clientRequestId"
              params={{ clientRequestId: item.id }}
              className="speakup-card flex flex-wrap items-center gap-3 p-4 transition hover:border-primary/40"
            >
              <span className="font-mono text-[11px] text-muted-foreground">{item.number}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-navy">{item.title}</span>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">
                {t(`client.type.${item.type}`)}
              </span>
              <ClientStatusBadge status={item.status} />
              <span className="text-[11px] text-muted-foreground">{formatDate(item.created_date, lang)}</span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="speakup-card px-4 py-12 text-center">
          <FileText className="mx-auto h-6 w-6 text-muted-foreground/60" />
          <p className="mt-2 text-sm font-medium text-navy">{t("client.empty")}</p>
        </div>
      )}
    </div>
  );
}
