import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { listAuditLog } from "@/lib/admin-fns";
import { useI18n } from "@/lib/i18n";
import { formatDateTime } from "@/lib/roles";

export const Route = createFileRoute("/_authed/admin/audit")({
  head: () => ({ meta: [{ title: "SpeakUp — Журнал действий" }] }),
  component: AuditPage,
});

function AuditPage() {
  const { t, lang } = useI18n();
  const fetchLog = useServerFn(listAuditLog);
  const { data, isLoading } = useQuery({ queryKey: ["audit"], queryFn: () => fetchLog() });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-heading text-2xl font-bold text-navy sm:text-3xl">{t("nav.audit")}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t("admin.auditSub")}</p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.loading")}
        </div>
      ) : data?.items?.length ? (
        <div className="speakup-card divide-y divide-border overflow-hidden">
          {data.items.map((entry) => (
            <div key={entry.id} className="px-5 py-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold text-navy">{t(`audit.${entry.action}`)}</p>
                <p className="text-[11px] text-muted-foreground">{formatDateTime(entry.created_date, lang)}</p>
              </div>
              <p className="mt-1 break-words text-[11px] text-muted-foreground">
                {entry.user_name || entry.user_email} · {entry.details}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="speakup-card px-5 py-16 text-center text-sm text-muted-foreground">{t("admin.auditEmpty")}</div>
      )}
    </div>
  );
}
