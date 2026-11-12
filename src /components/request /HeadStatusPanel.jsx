import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Eye, HelpCircle, Loader2, PlayCircle, XCircle } from "lucide-react";
import { updateRequest } from "@/lib/speakup-fns";
import { useI18n } from "@/lib/i18n";

const inputClass =
  "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

// The head moves a request of his department through the whole workflow.
const HEAD_STATUSES = ["review", "inProgress", "waiting", "implemented", "rejected", "closed"];
const STATUS_ICONS = {
  review: Eye,
  inProgress: PlayCircle,
  waiting: HelpCircle,
  implemented: CheckCircle2,
  rejected: XCircle,
  closed: CheckCircle2,
};
const STATUS_TONES = {
  rejected: "border-[#EF4444]/30 bg-[#EF4444]/10 text-[#B91C1C] hover:bg-[#EF4444]/15",
  closed: "border-[#20AFA4]/30 bg-[#20AFA4]/10 text-[#158078] hover:bg-[#20AFA4]/15",
};

export default function HeadStatusPanel({ request }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const save = useServerFn(updateRequest);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (status) => save({ data: { id: request.id, status, comment: comment.trim() } }),
    onSuccess: () => {
      setError("");
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["request", request.id] });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      queryClient.invalidateQueries({ queryKey: ["distribution"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err) => {
      if (err?.status === 400) setError(t("detail.rejectReason"));
      else setError(t("common.error"));
    },
  });

  const act = (status) => {
    if ((status === "rejected" || status === "closed") && !comment.trim()) {
      setError(status === "rejected" ? t("detail.rejectReason") : t("detail.commentRequired"));
      return;
    }
    setError("");
    mutation.mutate(status);
  };

  return (
    <div className="space-y-3">
      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        rows={3}
        placeholder={t("detail.statusCommentPh")}
        className={inputClass}
      />
      {error ? <p className="text-[11px] font-medium text-destructive">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        {HEAD_STATUSES.map((status) => {
          const Icon = STATUS_ICONS[status];
          return (
            <button
              key={status}
              type="button"
              onClick={() => act(status)}
              disabled={mutation.isPending || request.status === status}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition disabled:opacity-50 ${
                request.status === status
                  ? "border-primary bg-primary/10 text-primary"
                  : STATUS_TONES[status] || "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-navy"
              }`}
            >
              {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
              {t(`status.${status}`)}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">{t("detail.statusSub")}</p>
    </div>
  );
}
