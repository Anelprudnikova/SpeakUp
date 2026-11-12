import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import ClientStatusBadge from "@/components/client/ClientStatusBadge";
import { listClientQueue } from "@/lib/client-fns";
import { useI18n } from "@/lib/i18n";
import { CLIENT_STATUSES, formatDate } from "@/lib/roles";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authed/client-requests/")({
  head: () => ({ meta: [{ title: "SpeakUp — Клиентские обращения" }] }),
  component: ClientQueuePage,
});

function ClientQueuePage() {
  const { t, lang } = useI18n();
  const fetchQueue = useServerFn(listClientQueue);
  const [status, setStatus] = useState("");
  const [mine, setMine] = useState(false);
  const { data, isLoading, error } = useQuery({
    queryKey: ["client-queue", status, mine],
    queryFn: () => fetchQueue({ data: { status: status || undefined, mine } }),
    retry: false,
  });

  if (error) {
    return <p className="speakup-card p-6 text-sm text-muted-foreground">{t("mgr.forbidden")}</p>;
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-navy sm:text-3xl">{t("mgr.queueHeading")}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {data?.viewer?.role === "employee" ? t("emp.clientSub") : t("mgr.queueSub")}
          </p>
        </div>
        {data?.viewer?.can_handoff ? (
          <Link
            to="/client-handoff"
            className="rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            {t("mgr.openHandoff")}
          </Link>
        ) : null}
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setStatus("")}
          className={cn(
            "rounded-xl border px-3 py-1.5 text-[11px] font-medium transition",
            !status ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-navy"
          )}
        >
          {t("common.all")} · {data?.counts?.all ?? 0}
        </button>
        {CLIENT_STATUSES.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatus(value)}
            className={cn(
              "rounded-xl border px-3 py-1.5 text-[11px] font-medium transition",
              status === value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-navy"
            )}
          >
            {t(`client.status.${value}`)} · {data?.counts?.[value] ?? 0}
          </button>
        ))}
        {data?.viewer?.can_handoff ? (
          <label className="ml-auto flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
            <input type="checkbox" checked={mine} onChange={(event) => setMine(event.target.checked)} className="h-4 w-4 accent-[#4263EB]" />
            {t("mgr.filterMine")}
          </label>
        ) : null}
      </div>

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
              <span className="hidden truncate text-[11px] text-muted-foreground sm:block">
                {item.author_name} · {item.author_email}
              </span>
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
