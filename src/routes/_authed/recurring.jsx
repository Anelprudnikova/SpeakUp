import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Layers, Loader2, Save, X } from "lucide-react";
import { createRelatedIssue, getRecurring, updateRelatedIssue } from "@/lib/analytics-fns";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/roles";

export const Route = createFileRoute("/_authed/recurring")({
  head: () => ({ meta: [{ title: "SpeakUp — Повторяющиеся проблемы" }] }),
  component: RecurringPage,
});

function RecurringPage() {
  const { t } = useI18n();
  const fetchRecurring = useServerFn(getRecurring);
  const { data, isLoading } = useQuery({ queryKey: ["recurring"], queryFn: () => fetchRecurring() });
  const [dismissed, setDismissed] = useState([]);

  const suggestions = (data?.suggestions || []).filter((s) => !dismissed.includes(s.token));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl font-bold text-navy sm:text-3xl">{t("rec.heading")}</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{t("rec.sub")}</p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.loading")}
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="font-heading text-base font-semibold text-navy">{t("rec.suggestions")}</h2>
            {suggestions.length ? (
              suggestions.map((suggestion) => (
                <SuggestionRow
                  key={suggestion.token}
                  suggestion={suggestion}
                  onDismiss={() => setDismissed((prev) => [...prev, suggestion.token])}
                />
              ))
            ) : (
              <div className="speakup-card px-5 py-10 text-center text-sm text-muted-foreground">{t("rec.noSuggestions")}</div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-base font-semibold text-navy">{t("rec.issues")}</h2>
            {data?.issues?.length ? (
              data.issues.map((issue) => <IssueCard key={issue.id} issue={issue} />)
            ) : (
              <div className="speakup-card px-5 py-10 text-center text-sm text-muted-foreground">{t("rec.noIssues")}</div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function SuggestionRow({ suggestion, onDismiss }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const create = useServerFn(createRelatedIssue);
  const [name, setName] = useState(suggestion.default_name || suggestion.token);

  const mutation = useMutation({
    mutationFn: () =>
      create({ data: { name, description: t("rec.basedOn", { token: suggestion.token }), request_ids: suggestion.request_ids } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring"] });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
    },
  });

  return (
    <div className="speakup-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#7957E8]">
            {t("rec.basedOn", { token: suggestion.token })}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("rec.requests", { count: suggestion.count })} · {suggestion.numbers.join(", ")}
          </p>
          {suggestion.departments?.length ? (
            <p className="mt-1 text-[11px] text-muted-foreground">{suggestion.departments.join(" · ")}</p>
          ) : null}
        </div>
        <button type="button" onClick={onDismiss} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label={t("rec.dismiss")}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t("rec.issueName")}
          className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || name.trim().length < 3}
          className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Layers className="h-3.5 w-3.5" />}
          {t("rec.confirm")}
        </button>
      </div>
    </div>
  );
}

function IssueCard({ issue }) {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const save = useServerFn(updateRelatedIssue);
  const [form, setForm] = useState({ status: issue.status, actions: issue.actions, result: issue.result });

  const mutation = useMutation({
    mutationFn: () => save({ data: { id: issue.id, ...form } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recurring"] }),
  });

  return (
    <div className="speakup-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-base font-semibold text-navy">{issue.name}</h3>
          {issue.description ? <p className="mt-1 text-xs text-muted-foreground">{issue.description}</p> : null}
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t("rec.owner")}: {issue.owner_email || "—"} · {formatDate(issue.created_date, lang)}
          </p>
        </div>
        <select
          value={form.status}
          onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
          className="rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold outline-none focus:border-primary"
        >
          {["open", "in_progress", "resolved"].map((status) => (
            <option key={status} value={status}>{t(`rec.status.${status}`)}</option>
          ))}
        </select>
      </div>

      <div className="mt-3 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("rec.linked")}</p>
        <ul className="flex flex-wrap gap-2">
          {issue.requests.map((request) => (
            <li key={request.id}>
              <Link
                to="/requests/$requestId"
                params={{ requestId: request.id }}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[11px] font-medium text-navy transition hover:border-primary/40 hover:text-primary"
              >
                <span className="font-mono">{request.number}</span>
                <span className="max-w-[180px] truncate">{request.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <textarea
          value={form.actions}
          onChange={(event) => setForm((prev) => ({ ...prev, actions: event.target.value }))}
          rows={2}
          placeholder={t("rec.actions")}
          className="rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
        />
        <textarea
          value={form.result}
          onChange={(event) => setForm((prev) => ({ ...prev, result: event.target.value }))}
          rows={2}
          placeholder={t("rec.result")}
          className="rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
        />
      </div>

      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-xs font-semibold text-navy transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
      >
        {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        {t("rec.save")}
      </button>
    </div>
  );
}
