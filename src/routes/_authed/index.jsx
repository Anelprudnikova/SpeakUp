import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, FileText, Plus, Clock3, CheckCircle2, Inbox, ArrowRight, AlertTriangle } from "lucide-react";
import ManagerClientSummary from "@/components/client/ManagerClientSummary";
import { getDashboard, markNotificationRead } from "@/lib/speakup-fns";
import { useI18n } from "@/lib/i18n";
import { formatDate, formatDateTime, shortPersonName } from "@/lib/roles";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import PriorityBadge from "@/components/PriorityBadge";

export const Route = createFileRoute("/_authed/")({
  head: () => ({ meta: [{ title: "SpeakUp — Главная" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const fetchDashboard = useServerFn(getDashboard);
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchDashboard() });
  const markRead = useServerFn(markNotificationRead);
  const readMutation = useMutation({
    mutationFn: (payload) => markRead({ data: payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  const role = data?.viewer?.role || "employee";
  const leader = role === "head" || role === "admin";
  const stats = data?.stats;
  // «Здравствуйте, Анна Евгеньевна!» — имя и отчество из профиля, без email и фамилии.
  const greetingName = [data?.viewer?.first_name, data?.viewer?.middle_name].filter(Boolean).join(" ");

  return (
    <div className="space-y-6">
      <section className="speakup-gradient relative overflow-hidden rounded-3xl px-6 py-8 text-white shadow-xl shadow-navy/15 sm:px-10 sm:py-10">
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/10" />
        <div className="absolute -bottom-24 right-24 h-52 w-52 rounded-full bg-white/5" />
        <div className="relative max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60">{t("app.tagline")}</p>
          <h1 className="mt-3 font-heading text-[26px] font-bold leading-tight sm:text-4xl">
            {t("dash.hello")}
            {greetingName ? `, ${greetingName}` : ""}
            {greetingName ? "!" : ""}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/75 sm:text-base">
            {leader ? t("dash.managerSubtitle") : t("dash.subtitle")}
          </p>
          <Link
            to="/requests/new"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-navy shadow-lg shadow-navy/20 transition hover:bg-white/90"
          >
            <Plus className="h-4 w-4" /> {t("dash.create")}
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {leader ? (
          <>
            <StatCard icon={FileText} label={t("dash.totalRequests")} value={isLoading ? "…" : stats?.total ?? 0} tone="primary" />
            <StatCard icon={Inbox} label={t("dash.unassigned")} value={isLoading ? "…" : stats?.unassigned ?? 0} tone="violet" />
            <StatCard icon={Clock3} label={t("dash.awaitingReview")} value={isLoading ? "…" : stats?.awaitingReview ?? 0} tone="amber" />
            <StatCard icon={CheckCircle2} label={t("dash.resolvedRate")} value={stats?.resolvedRate === null ? "—" : `${stats?.resolvedRate ?? 0}%`} tone="teal" />
          </>
        ) : (
          <>
            <StatCard icon={FileText} label={t("dash.myTotal")} value={isLoading ? "…" : stats?.mineTotal ?? 0} tone="primary" />
            <StatCard icon={Inbox} label={t("nav.assigned")} value={isLoading ? "…" : stats?.assignedOpen ?? 0} tone="violet" />
            <StatCard icon={Clock3} label={t("dash.myInProgress")} value={isLoading ? "…" : stats?.mineInProgress ?? 0} tone="amber" />
            <StatCard icon={CheckCircle2} label={t("dash.myResolved")} value={isLoading ? "…" : stats?.mineResolved ?? 0} tone="teal" />
          </>
        )}
      </section>

      {stats?.firstResponseOverdue ? (
        <p className="flex items-center gap-2 rounded-2xl border border-destructive/25 bg-destructive/5 px-4 py-3 text-xs font-semibold text-destructive">
          <AlertTriangle className="h-4 w-4" /> {t("dash.firstResponseOverdue", { count: stats.firstResponseOverdue })}
        </p>
      ) : null}

      {role === "client_manager" ? <ManagerClientSummary /> : null}

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <section className="speakup-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-heading text-base font-semibold text-navy">
              {leader ? t("dash.queue") : t("dash.recent")}
            </h2>
            <Link
              to={leader ? "/distribution" : "/requests"}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              {t("common.viewAll")} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {isLoading ? (
              <p className="px-5 py-8 text-sm text-muted-foreground">{t("common.loading")}</p>
            ) : data?.recent?.length ? (
              data.recent.map((r) => (
                <Link
                  key={r.id}
                  to="/requests/$requestId"
                  params={{ requestId: r.id }}
                  className="block px-5 py-4 transition hover:bg-muted/50"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] font-semibold text-muted-foreground">{r.number}</span>
                    <StatusBadge value={r.status} />
                    <PriorityBadge value={r.priority} />
                    {r.is_overdue ? (
                      <span className="text-[11px] font-semibold text-destructive">{t("common.overdue")}</span>
                    ) : null}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-medium text-foreground">{r.title}</p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {r.category_names?.[lang] || r.category_names?.ru || t(`cat.${r.category_key}`)} ·{" "}
                    {formatDate(r.created_date, lang)}
                  </p>
                </Link>
              ))
            ) : (
              <p className="px-5 py-8 text-sm text-muted-foreground">{t("dash.empty")}</p>
            )}
          </div>
        </section>

        <section className="speakup-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-heading text-base font-semibold text-navy">{t("dash.notifications")}</h2>
            <Link to="/notifications" aria-label={t("nav.notifications")}>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {data?.notifications?.length ? (
              data.notifications.map((n) => {
                const body = (
                  <>
                    <p className="text-sm leading-snug text-foreground">
                      {t(`notif.${n.event}`, { number: n.number })}
                    </p>
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
                  </>
                );
                return (
                  <div key={n.id} className="flex gap-3 px-5 py-4">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.is_read ? "bg-border" : "bg-primary"}`} />
                    {n.request_id ? (
                      <Link
                        to={n.scope === "client" ? "/client-requests/$clientRequestId" : "/requests/$requestId"}
                        params={n.scope === "client" ? { clientRequestId: n.request_id } : { requestId: n.request_id }}
                        onClick={() => !n.is_read && readMutation.mutate({ id: n.id })}
                        className="min-w-0 flex-1 transition hover:text-primary"
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="min-w-0 flex-1">{body}</div>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="px-5 py-8 text-sm text-muted-foreground">{t("notif.empty")}</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
