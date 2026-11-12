import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, HelpCircle, Loader2, PlayCircle, Save, Send } from "lucide-react";
import { updateRequest } from "@/lib/speakup-fns";
import { useI18n } from "@/lib/i18n";

const inputClass =
  "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

const STATUS_ICONS = { inProgress: PlayCircle, waiting: HelpCircle, implemented: CheckCircle2 };

// The executor works the assigned request: progress statuses, the result of the work
// and one button that hands it to the head for verification. Closing is not his.
export default function WorkPanel({ request, selfExecution = false }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const save = useServerFn(updateRequest);
  const [comment, setComment] = useState("");
  const [form, setForm] = useState({
    actions_taken: request.actions_taken || "",
    result: request.result || "",
  });
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (payload) => save({ data: { id: request.id, ...payload } }),
    onSuccess: () => {
      setError("");
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["request", request.id] });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      queryClient.invalidateQueries({ queryKey: ["assigned"] });
      queryClient.invalidateQueries({ queryKey: ["review"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => setError(t("common.error")),
  });

  const workStatuses = selfExecution
    ? ["inProgress", "waiting", "implemented"]
    : ["inProgress", "waiting"];

  const setStatus = (status) => mutation.mutate({ status, comment: comment.trim() });

  // The result description is what the head verifies, so it is required here.
  const submitForReview = () => {
    const result = form.result.trim() || comment.trim();
    if (!result) {
      setError(t("detail.resultRequired"));
      return;
    }
    setError("");
    mutation.mutate({ status: "implemented", comment: comment.trim(), result });
  };

  return (
    <div className="space-y-4">
      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        rows={2}
        placeholder={t("detail.statusCommentPh")}
        className={inputClass}
      />

      <div className="flex flex-wrap gap-2">
        {workStatuses.map((status) => {
          const Icon = STATUS_ICONS[status];
          return (
            <button
              key={status}
              type="button"
              onClick={() => setStatus(status)}
              disabled={mutation.isPending || request.status === status}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                request.status === status
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-navy"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t(`status.${status}`)}
            </button>
          );
        })}
      </div>

      <div className="space-y-3 rounded-xl bg-muted/50 p-3.5">
        <textarea
          value={form.actions_taken}
          onChange={(event) => setForm((prev) => ({ ...prev, actions_taken: event.target.value }))}
          rows={2}
          placeholder={t("detail.actionsPh")}
          className={inputClass}
        />
        <textarea
          value={form.result}
          onChange={(event) => setForm((prev) => ({ ...prev, result: event.target.value }))}
          rows={3}
          placeholder={t("detail.resultPh")}
          className={inputClass}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => mutation.mutate({ actions_taken: form.actions_taken, result: form.result })}
            disabled={mutation.isPending}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-semibold text-navy transition hover:border-primary/40 hover:text-primary disabled:opacity-60"
          >
            {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {t("detail.saveChanges")}
          </button>
          {!selfExecution ? (
            <button
              type="button"
              onClick={submitForReview}
              disabled={mutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
            >
              {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {t("detail.sendToReview")}
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="text-[11px] font-medium text-destructive">{error}</p> : null}
      <p className="text-[11px] text-muted-foreground">
        {selfExecution ? t("detail.selfReviewHint") : t("detail.workStatusesHint")}
      </p>
    </div>
  );
}
