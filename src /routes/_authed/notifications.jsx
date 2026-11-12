import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, CheckCheck, Loader2 } from "lucide-react";
import { getNotifications, markNotificationRead } from "@/lib/speakup-fns";
import { useI18n } from "@/lib/i18n";
import { formatDateTime, shortPersonName } from "@/lib/roles";

export const Route = createFileRoute("/_authed/notifications")({
  head: () => ({ meta: [{ title: "SpeakUp — Уведомления" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const fetchNotifications = useServerFn(getNotifications);
  const markRead = useServerFn(markNotificationRead);
  const { data, isLoading } = useQuery({ queryKey: ["notifications"], queryFn: () => fetchNotifications() });

  const mutation = useMutation({
    mutationFn: (payload) => markRead({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-navy sm:text-3xl">{t("notif.heading")}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{t("client.notifSub")}</p>
        </div>
        {data?.unread ? (
          <button
            type="button"
            onClick={() => mutation.mutate({ all: true })}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-navy transition hover:border-primary/30 hover:text-primary"
          >
            <CheckCheck className="h-4 w-4" /> {t("notif.markAll")}
          </button>
        ) : null}
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.loading")}
        </div>
      ) : data?.items?.length ? (
        <div className="speakup-card divide-y divide-border overflow-hidden">
          {data.items.map((n) => (
            <div key={n.id} className={`flex items-start gap-3 px-5 py-4 ${n.is_read ? "" : "bg-primary/[0.03]"}`}>
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.is_read ? "bg-border" : "bg-primary"}`} />
              <div className="min-w-0 flex-1">
                {n.request_id ? (
                  <Link
                    to={n.scope === "client" ? "/client-requests/$clientRequestId" : "/requests/$requestId"}
                    params={
                      n.scope === "client"
                        ? { clientRequestId: n.request_id }
                        : { requestId: n.request_id }
                    }
                    onClick={() => !n.is_read && mutation.mutate({ id: n.id })}
                    className="text-sm font-medium text-navy hover:text-primary"
                  >
                    {t(`notif.${n.event}`, { number: n.number })}
                  </Link>
                ) : (
                  <p className="text-sm font-medium text-navy">{t(`notif.${n.event}`, { number: n.number })}</p>
                )}
                {n.subject ? (
                  <p className="mt-1 text-xs text-navy">{t("notif.subject", { subject: n.subject })}</p>
                ) : null}
                {n.client_name || n.department_name ? (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {n.client_name ? t("notif.clientName", { name: n.client_name }) : ""}
                    {n.client_name && n.department_name ? " · " : ""}
                    {n.department_name ? t("notif.departmentName", { department: n.department_name }) : ""}
                  </p>
                ) : null}
                {n.manager_name ? (
                  <p className="mt-0.5 text-[11px] font-medium text-navy">
                    {t("notif.managerName", { name: shortPersonName(n.manager_name) })}
                  </p>
                ) : null}
                <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(n.created_date, lang)}</p>
              </div>
              {!n.is_read ? (
                <button
                  type="button"
                  onClick={() => mutation.mutate({ id: n.id })}
                  className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-primary"
                  aria-label={t("notif.unread")}
                >
                  <Check className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="speakup-card px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">{t("notif.empty")}</p>
        </div>
      )}
    </div>
  );
}
