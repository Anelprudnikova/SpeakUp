import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import ClientStatusBadge from "@/components/client/ClientStatusBadge";
import ClientThread from "@/components/client/ClientThread";
import ClientAssignPanel from "@/components/client/ClientAssignPanel";
import ClientWorkPanel from "@/components/client/ClientWorkPanel";
import ClientReplyPanel from "@/components/client/ClientReplyPanel";
import ChangeDepartment from "@/components/client/ChangeDepartment";
import { getClientRequest, takeClientRequest, updateClientRequest } from "@/lib/client-fns";
import { useI18n } from "@/lib/i18n";
import { CLIENT_STATUSES, formatDateTime, shortPersonName } from "@/lib/roles";

export const Route = createFileRoute("/_authed/client-requests/$clientRequestId")({
  head: () => ({ meta: [{ title: "SpeakUp — Клиентское обращение" }] }),
  component: ManagerClientRequestPage,
});

function ManagerClientRequestPage() {
  const { t, lang } = useI18n();
  const { clientRequestId } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchRequest = useServerFn(getClientRequest);
  const take = useServerFn(takeClientRequest);
  const save = useServerFn(updateClientRequest);

  const [reply, setReply] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [result, setResult] = useState("");
  const [status, setStatus] = useState("");
  const [clarify, setClarify] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["client-request", clientRequestId],
    queryFn: () => fetchRequest({ data: { id: clientRequestId } }),
    retry: false,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["client-request", clientRequestId] });
    queryClient.invalidateQueries({ queryKey: ["client-queue"] });
  };

  const takeMutation = useMutation({
    mutationFn: () => take({ data: { id: clientRequestId } }),
    onSuccess: refresh,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          id: clientRequestId,
          status: status || undefined,
          result: result || undefined,
          reply: reply.trim() || undefined,
          internal_note: internalNote.trim() || undefined,
          request_clarification: clarify || undefined,
        },
      }),
    onSuccess: () => {
      setReply("");
      setInternalNote("");
      setClarify(false);
      refresh();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.loading")}
      </div>
    );
  }
  if (error || !data || data.forbidden) {
    return <p className="speakup-card p-6 text-sm text-muted-foreground">{t("mgr.forbidden")}</p>;
  }

  const item = data.item;
  const currentStatus = status || item.status;

  return (
    <div className="space-y-5">
      <Link to="/client-requests" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-3.5 w-3.5" /> {t("mgr.queueHeading")}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] text-muted-foreground">{item.number}</p>
          <h1 className="mt-1 font-heading text-xl font-bold text-navy sm:text-2xl">{item.title}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("mgr.client")}: {item.author_name} · {item.author_email} · {formatDateTime(item.created_date, lang)}
          </p>
        </div>
        <ClientStatusBadge status={item.status} />
      </header>

      <section className="speakup-card space-y-3 p-5">
        <p className="whitespace-pre-line text-sm leading-relaxed text-navy">{item.description}</p>
        <p className="text-[11px] text-muted-foreground">{t(`client.type.${item.type}`)}</p>
        {item.internal_request_number ? (
          <div className="space-y-1 rounded-lg bg-muted px-3 py-2 text-[11px] text-muted-foreground">
            <div className="flex flex-wrap items-center gap-2">
              <span>
                {t("mgr.linkedInternal")}: {item.internal_request_number} ·{" "}
                {t("mgr.handoffInfo", { department: item.department_name })}
              </span>
              {data.can_change_department ? (
                <ChangeDepartment item={item} departments={data.departments || []} />
              ) : null}
            </div>
            {item.handoff_by_name ? (
              <p className="font-medium text-navy">
                {t("mgr.handoffBy", { name: shortPersonName(item.handoff_by_name) })}
                {item.handoff_at ? ` · ${formatDateTime(item.handoff_at, lang)}` : ""}
              </p>
            ) : null}
          </div>
        ) : null}
        {!item.manager_email && data.manager ? (
          <button
            type="button"
            onClick={() => takeMutation.mutate()}
            disabled={takeMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-xl border border-primary px-3.5 py-2 text-xs font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-50"
          >
            {takeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {t("mgr.take")}
          </button>
        ) : null}
      </section>

      <section className="speakup-card space-y-3 p-5">
        <h2 className="font-heading text-base font-semibold text-navy">{t("client.messages")}</h2>
        <ClientThread messages={data.messages} managerView={data.manager} />
      </section>

      {data.can_assign ? (
        <ClientAssignPanel item={item} assignees={data.assignees || []} canReview={data.can_review} />
      ) : null}

      {data.can_reply ? <ClientReplyPanel item={item} /> : null}

      {data.can_work ? <ClientWorkPanel item={item} /> : null}

      {data.manager ? (
      <section className="speakup-card space-y-3 p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-navy">{t("client.status")}</span>
            <select
              value={currentStatus}
              onChange={(event) => setStatus(event.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-xs outline-none focus:border-primary"
            >
              {CLIENT_STATUSES.map((value) => (
                <option key={value} value={value}>{t(`client.status.${value}`)}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-navy">{t("mgr.result")}</span>
            <input
              value={result}
              onChange={(event) => setResult(event.target.value)}
              placeholder={t("mgr.resultPh")}
              className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-xs outline-none focus:border-primary"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-navy">{t("mgr.reply")}</span>
          <textarea
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            placeholder={t("mgr.replyPh")}
            rows={3}
            className="w-full resize-y rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
          <input type="checkbox" checked={clarify} onChange={(event) => setClarify(event.target.checked)} className="h-4 w-4 accent-[#4263EB]" />
          {t("client.status.clarification")}
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-navy">{t("mgr.internalNote")}</span>
          <textarea
            value={internalNote}
            onChange={(event) => setInternalNote(event.target.value)}
            rows={2}
            className="w-full resize-y rounded-xl border border-dashed border-[#7957E8]/40 bg-[#7957E8]/[0.03] px-3.5 py-2.5 text-sm outline-none focus:border-[#7957E8]"
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">{t("mgr.internalNoteHint")}</span>
        </label>

        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          {t("mgr.save")}
        </button>
      </section>
      ) : null}
    </div>
  );
}
