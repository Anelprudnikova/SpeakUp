import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, Loader2 } from "lucide-react";
import { getClientNotifications, markClientNotificationsRead } from "@/lib/client-fns";
import { useI18n } from "@/lib/i18n";
import { formatDateTime } from "@/lib/roles";

export const Route = createFileRoute("/client/notifications")({
  head: () => ({ meta: [{ title: "SpeakUp — Уведомления" }] }),
  component: ClientNotificationsPage,
});

function ClientNotificationsPage() {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const fetchNotifications = useServerFn(getClientNotifications);
  const markRead = useServerFn(markClientNotificationsRead);
  const { data, isLoading } = useQuery({
    queryKey: ["client-notifications"],
    queryFn: () => fetchNotifications(),
  });

  const mutation = useMutation({
    mutationFn: (payload) => markRead({ data: payload }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["client-notifications"] }),
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-navy sm:text-3xl">{t("client.notifHeading")}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{t("client.notifSub")}</p>
        </div>
        {data?.unread ? (
          <button
            type="button"
            onClick={() => mutation.mutate({ all: true })}
            className="rounded-xl border border-border px-3.5 py-2 text-xs font-semibold text-navy transition hover:border-primary/40 hover:text-primary"
          >
            {t("client.notifMarkAll")}
          </button>
        ) : null}
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.loading")}
        </div>
      ) : data?.items?.length ? (
        <div className="space-y-2">
          {data.items.map((notification) => (
            <div
              key={notification.id}
              className={`speakup-card flex flex-wrap items-center gap-3 p-4 ${notification.is_read ? "" : "border-[#7957E8]/30"}`}
            >
              <Bell className={`h-4 w-4 shrink-0 ${notification.is_read ? "text-muted-foreground/60" : "text-[#7957E8]"}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-navy">
                  {t(`notif.${notification.event}`, { number: notification.number || "" })}
                </p>
                <p className="text-[11px] text-muted-foreground">{formatDateTime(notification.created_date, lang)}</p>
              </div>
              {notification.request_id ? (
                <Link
                  to="/client/requests/$clientRequestId"
                  params={{ clientRequestId: notification.request_id }}
                  onClick={() => !notification.is_read && mutation.mutate({ id: notification.id })}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  {t("client.open")}
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="speakup-card px-4 py-12 text-center">
          <Bell className="mx-auto h-6 w-6 text-muted-foreground/60" />
          <p className="mt-2 text-sm font-medium text-navy">{t("client.notifEmpty")}</p>
        </div>
      )}
    </div>
  );
}
