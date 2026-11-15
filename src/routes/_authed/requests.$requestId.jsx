import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Lock, Loader2 } from "lucide-react";
import { getRequest } from "@/lib/speakup-fns";
import { useI18n } from "@/lib/i18n";
import StatusBadge from "@/components/StatusBadge";
import PriorityBadge from "@/components/PriorityBadge";
import RequestMeta from "@/components/request/RequestMeta";
import AssignPanel from "@/components/request/AssignPanel";
import WorkPanel from "@/components/request/WorkPanel";
import ReviewPanel from "@/components/request/ReviewPanel";
import WithdrawReviewPanel from "@/components/request/WithdrawReviewPanel";
import HeadStatusPanel from "@/components/request/HeadStatusPanel";
import SelfExecuteBar from "@/components/request/SelfExecuteBar";
import SelfClosePanel from "@/components/request/SelfClosePanel";
import DeleteRequestButton from "@/components/request/DeleteRequestButton";
import CommentsSection from "@/components/request/CommentsSection";
import HistoryList from "@/components/request/HistoryList";
import AttachmentsList from "@/components/request/AttachmentsList";

export const Route = createFileRoute("/_authed/requests/$requestId")({
  head: () => ({ meta: [{ title: "SpeakUp — Обращение" }] }),
  component: RequestDetailPage,
});

function RequestDetailPage() {
  const { requestId } = Route.useParams();
  const { t, lang } = useI18n();
  const fetchRequest = useServerFn(getRequest);
  const { data, isLoading } = useQuery({
    queryKey: ["request", requestId],
    queryFn: () => fetchRequest({ data: { id: requestId } }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.loading")}
      </div>
    );
  }

  if (!data || data.forbidden || !data.request) {
    return (
      <div className="speakup-card mx-auto max-w-lg px-6 py-16 text-center">
        <p className="font-heading text-base font-semibold text-navy">
          {data?.forbidden ? t("detail.forbidden") : t("detail.notFound")}
        </p>
        <Link to="/requests" className="mt-4 inline-block text-xs font-semibold text-primary hover:underline">
          {t("detail.back")}
        </Link>
      </div>
    );
  }

  const { request } = data;
  const decisionFilled = [request.decision, request.decision_reason, request.planned_actions, request.actions_taken, request.result].some(Boolean);

  return (
    <div className="space-y-5">
      <Link to="/requests" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition hover:text-primary">
        <ArrowLeft className="h-3.5 w-3.5" /> {t("detail.back")}
      </Link>

      <header className="speakup-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] font-semibold text-muted-foreground">{request.number}</span>
          <StatusBadge value={request.status} />
          <PriorityBadge value={request.priority} />
          {request.privacy_mode === "confidential" ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#7957E8]/20 bg-[#7957E8]/10 px-2.5 py-1 text-[11px] font-semibold text-[#7957E8]">
              <Lock className="h-3 w-3" /> {t("request.confidentialBadge")}
            </span>
          ) : null}
          {request.is_overdue ? (
            <span className="rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-semibold text-destructive">{t("common.overdue")}</span>
          ) : null}
        </div>
        <h1 className="mt-3 font-heading text-xl font-bold leading-snug text-navy sm:text-2xl">{request.title}</h1>
        <p className="mt-2 text-xs text-muted-foreground">
          {request.category_names?.[lang] || request.category_names?.ru || "—"}
          {request.department_name ? ` · ${request.department_name}` : ""}
          {request.author_hidden ? ` · ${t("request.hiddenAuthor")}` : request.author_name ? ` · ${request.author_name}` : ""}
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <section className="speakup-card p-5 sm:p-6">
            <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {t("request.description")}
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{request.description}</p>
            {request.proposed_solution ? (
              <div className="mt-4 rounded-xl bg-[#20AFA4]/[0.07] p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#158078]">{t("request.solution")}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{request.proposed_solution}</p>
              </div>
            ) : null}
          </section>

          <section className="speakup-card p-5 sm:p-6">
            <h2 className="font-heading text-base font-semibold text-navy">{t("request.decision")}</h2>
            {decisionFilled ? (
              <div className="mt-3 space-y-3 text-sm">
                <DecisionRow label={t("request.decision")} value={request.decision} />
                <DecisionRow label={t("detail.reason")} value={request.decision_reason} />
                <DecisionRow label={t("detail.planned")} value={request.planned_actions} />
                <DecisionRow label={t("detail.done")} value={request.actions_taken} />
                <DecisionRow label={t("detail.result")} value={request.result} />
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">{t("detail.noDecision")}</p>
            )}
          </section>

          {data.can_manage ? (
            <section className="speakup-card p-5 sm:p-6">
              <h2 className="mb-4 font-heading text-base font-semibold text-navy">{t("detail.assignTitle")}</h2>
              {data.is_self_execution || data.can_self_execute ? (
                <SelfExecuteBar
                  request={request}
                  email={data.viewer.email}
                  active={data.is_self_execution}
                />
              ) : null}
              <AssignPanel
                request={request}
                assignees={data.assignees || []}
                disabled={["closed", "implemented", "rejected"].includes(request.status)}
              />
            </section>
          ) : null}

          {data.can_manage && !data.is_self_execution && request.status !== "implemented" ? (
            <section className="speakup-card p-5 sm:p-6">
              <h2 className="mb-1 font-heading text-base font-semibold text-navy">{t("detail.statusTitle")}</h2>
              <p className="mb-3 text-[11px] text-muted-foreground">{t("detail.statusSub")}</p>
              <HeadStatusPanel request={request} />
            </section>
          ) : null}

          {data.can_review ? (
            <section className="speakup-card p-5 sm:p-6">
              <h2 className="mb-1 font-heading text-base font-semibold text-navy">{t("detail.reviewTitle")}</h2>
              <p className="mb-3 text-[11px] text-muted-foreground">{t("detail.reviewSub")}</p>
              <ReviewPanel request={request} />
            </section>
          ) : null}

          {data.can_work ? (
            <section className="speakup-card p-5 sm:p-6">
              <h2 className="mb-4 font-heading text-base font-semibold text-navy">{t("detail.workTitle")}</h2>
              <WorkPanel request={request} selfExecution={data.is_self_execution} />
            </section>
          ) : null}

          {data.can_withdraw_review ? (
            <section className="speakup-card p-5 sm:p-6">
              <h2 className="mb-1 font-heading text-base font-semibold text-navy">{t("detail.withdrawTitle")}</h2>
              <p className="mb-3 text-[11px] text-muted-foreground">{t("detail.withdrawSub")}</p>
              <WithdrawReviewPanel request={request} />
            </section>
          ) : null}

          {data.can_self_close ? (
            <section className="speakup-card p-5 sm:p-6">
              <h2 className="mb-1 font-heading text-base font-semibold text-navy">{t("detail.selfCloseTitle")}</h2>
              <p className="mb-3 text-[11px] text-muted-foreground">{t("detail.selfCloseSub")}</p>
              <SelfClosePanel request={request} />
            </section>
          ) : null}

          <section className="speakup-card p-5 sm:p-6">
            <h2 className="mb-4 font-heading text-base font-semibold text-navy">{t("request.comments")}</h2>
            <CommentsSection request={data} canManage={data.can_manage} isAuthor={data.is_author} />
          </section>

          <section className="speakup-card p-5 sm:p-6">
            <h2 className="mb-4 font-heading text-base font-semibold text-navy">{t("request.history")}</h2>
            <HistoryList history={data.history} />
          </section>
        </div>

        <aside className="space-y-5">
          <section className="speakup-card p-5">
            <RequestMeta request={request} />
          </section>

          {data.can_delete ? (
            <section className="speakup-card p-5">
              <DeleteRequestButton request={request} />
            </section>
          ) : null}

          <section className="speakup-card p-5">
            <h2 className="mb-3 font-heading text-sm font-semibold text-navy">{t("request.attachments")}</h2>
            <AttachmentsList attachments={data.attachments} />
          </section>

          {data.related_issues?.length ? (
            <section className="speakup-card p-5">
              <h2 className="mb-3 font-heading text-sm font-semibold text-navy">{t("detail.relatedIssues")}</h2>
              <ul className="space-y-2">
                {data.related_issues.map((issue) => (
                  <li key={issue.id} className="rounded-xl bg-muted/60 px-3 py-2.5 text-xs font-medium text-navy">
                    {issue.name}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {request.privacy_mode === "confidential" ? (
            <section className="rounded-2xl border border-[#7957E8]/20 bg-[#7957E8]/[0.05] p-4 text-[11px] leading-relaxed text-[#5b41b8]">
              {t("detail.confidentialNote")}
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function DecisionRow({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap leading-relaxed text-foreground">{value}</p>
    </div>
  );
}
