import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import ClientStatusBadge from "@/components/client/ClientStatusBadge";
import { listClientQueue } from "@/lib/client-fns";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/roles";

// The client manager's «Назначено мне»: client requests taken by this manager.
export default function ManagerAssignedQueue({ showHeader = true }) {
  const { t, lang } = useI18n();
  const fetchQueue = useServerFn(listClientQueue);
  const { data, isLoading } = useQuery({
    queryKey: ["client-queue", "assigned"],
    queryFn: () => fetchQueue({ data: { mine: true } }),
    retry: false,
  });

  return (
    <div className="space-y-5">
      {showHeader ? (
        <header>
          <h1 className="font-heading text-2xl font-bold text-navy sm:text-3xl">{t("nav.assigned")}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{t("mgr.assignedSub")}</p>
        </header>
      ) : (
        <h2 className="font-heading text-lg font-bold text-navy">{t("nav.clientRequests")}</h2>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.loading")}
        </div>
      ) : data?.items?.length ? (
        <div className="space-y-2.5">
          {data.items.map((item) => (
            <Link
              key={item.id}
              to="/client-requests/$clientRequestId"
              params={{ clientRequestId: item.id }}
              className="speakup-card flex flex-wrap items-center gap-3 p-4 transition hover:border-primary/40"
            >
              <span className="font-mono text-[11px] text-muted-foreground">{item.number}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-navy">{item.title}</span>
              <span className="hidden truncate text-[11px] text-muted-foreground sm:block">{item.author_name}</span>
              <ClientStatusBadge status={item.status} />
              <span className="text-[11px] text-muted-foreground">{formatDate(item.created_date, lang)}</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="speakup-card px-4 py-12 text-center text-sm text-muted-foreground">{t("mgr.empty")}</p>
      )}
    </div>
  );
}
