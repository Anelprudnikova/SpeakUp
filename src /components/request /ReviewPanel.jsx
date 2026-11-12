import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, RotateCcw, XCircle } from "lucide-react";
import { updateRequest } from "@/lib/speakup-fns";
import { useI18n } from "@/lib/i18n";

const inputClass =
  "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

// The head verifies the submitted work: accept and close it, return it for rework
// or reject it. A reason is required for the last two.
export default function ReviewPanel({ request }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const save = useServerFn(updateRequest);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (status) =>
      save({
        data: {
          id: request.id,
          status,
          comment: comment.trim(),
          decision_reason: comment.trim(),
          decision: t(`status.${status}`),
        },
      }),
    onSuccess: () => {
      setError("");
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["request", request.id] });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      queryClient.invalidateQueries({ queryKey: ["review"] });
      queryClient.invalidateQueries({ queryKey: ["assigned"] });
      queryClient.invalidateQueries({ queryKey: ["distribution"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err) => {
      if (err?.status === 400) setError(t("detail.reasonRequired"));
      else setError(t("common.error"));
    },
  });

  const act = (status) => {
    // Accepting the result needs no justification; rework and rejection do.
    if (status !== "closed" && !comment.trim()) {
      setError(status === "rejected" ? t("detail.rejectRequired") : t("detail.reworkRequired"));
      return;
    }
    setError("");
    mutation.mutate(status);
  };

  const pending = (status) => mutation.isPending && mutation.variables === status;

  return (
    <div className="space-y-3">
      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        rows={3}
        placeholder={t("detail.reviewCommentPh")}
        className={inputClass}
      />
      {error ? <p className="text-[11px] font-medium text-destructive">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => act("closed")}
          disabled={mutation.isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-[#158078] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#116b64] disabled:opacity-60"
        >
          {pending("closed") ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {t("detail.acceptResult")}
        </button>
        <button
          type="button"
          onClick={() => act("inProgress")}
          disabled={mutation.isPending}
          className="inline-flex items-center gap-2 rounded-xl border border-[#F97316]/40 bg-[#F97316]/10 px-4 py-2.5 text-xs font-semibold text-[#C2410C] transition hover:bg-[#F97316]/15 disabled:opacity-60"
        >
          {pending("inProgress") ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
          {t("detail.returnForRework")}
        </button>
        <button
          type="button"
          onClick={() => act("rejected")}
          disabled={mutation.isPending}
          className="inline-flex items-center gap-2 rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 px-4 py-2.5 text-xs font-semibold text-[#B91C1C] transition hover:bg-[#EF4444]/15 disabled:opacity-60"
        >
          {pending("rejected") ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
          {t("detail.reject")}
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">{t("detail.reviewHint")}</p>
    </div>
  );
}
