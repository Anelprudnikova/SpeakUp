import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2 } from "lucide-react";
import { updateRequest } from "@/lib/speakup-fns";
import { useI18n } from "@/lib/i18n";

const inputClass =
  "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

// The head worked the request himself, so he confirms the result and closes it.
export default function SelfClosePanel({ request }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const save = useServerFn(updateRequest);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          id: request.id,
          status: "closed",
          decision_reason: comment.trim(),
          decision: t("status.closed"),
        },
      }),
    onSuccess: () => {
      setError("");
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["request", request.id] });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      queryClient.invalidateQueries({ queryKey: ["distribution"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err) => setError(err?.status === 400 ? t("detail.commentRequired") : t("common.error")),
  });

  const close = () => {
    if (!comment.trim()) {
      setError(t("detail.commentRequired"));
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="space-y-3">
      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        rows={3}
        placeholder={t("detail.selfClosePh")}
        className={inputClass}
      />
      {error ? <p className="text-[11px] font-medium text-destructive">{error}</p> : null}
      <button
        type="button"
        onClick={close}
        disabled={mutation.isPending}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
      >
        {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
        {t("detail.selfCloseAction")}
      </button>
    </div>
  );
}
