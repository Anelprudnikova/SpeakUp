import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Calculator } from "lucide-react";
import ClientStatusBadge from "@/components/client/ClientStatusBadge";
import { listClientQueue } from "@/lib/client-fns";
import { useI18n } from "@/lib/i18n";
import { CLIENT_STATUSES } from "@/lib/roles";

// The client manager's home shows only its own client workload.
export default function ManagerClientSummary() {
  const { t } = useI18n();
  const fetchQueue = useServerFn(listClientQueue);
  const { data } = useQuery({
    queryKey: ["client-queue", "", false],
    queryFn: () => fetchQueue({ data: {} }),
    retry: false,
  });
  const counts = data?.counts || {};

  return (
    <section className="speakup-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-base font-semibold text-navy">{t("mgr.queueHeading")}</h2>
        <Link to="/client-requests" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
          <Calculator className="h-3 w-3" /> {t("common.viewAll")}
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {CLIENT_STATUSES.map((status) => (
          <Link
            key={status}
            to="/client-requests"
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-2.5 py-1.5 text-[11px] font-medium text-navy transition hover:border-primary/40"
          >
            <ClientStatusBadge status={status} />
            <span>{counts[status] ?? 0}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
