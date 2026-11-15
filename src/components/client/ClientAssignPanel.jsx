import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, RotateCcw, UserPlus } from "lucide-react";
import { assignClientRequest, reviewClientRequest } from "@/lib/client-fns";
import { useI18n } from "@/lib/i18n";

const inputClass =
  "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

// The head appoints an executor from his own department and verifies the result.
export default function ClientAssignPanel({ item, assignees = [], canReview = false }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const assign = useServerFn(assignClientRequest);
  const review = useServerFn(reviewClientRequest);
  const [email, setEmail] = useState(item.assignee_email || "");
  const [result, setResult] = useState(item.result || "");
  const [error, setError] = useState("");

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["client-request", item.id] });
    queryClient.invalidateQueries({ queryKey: ["client-queue"] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const assignMutation = useMutation({
    mutationFn: () => assign({ data: { id: item.id, assignee_email: email } }),
    onSuccess: () => {
      setError("");
      refresh();
    },
    onError: (err) => setError(err?.status === 400 ? t("emp.noAssignees") : t("common.error")),
  });

  const reviewMutation = useMutation({
    mutationFn: (action) => review({ data: { id: item.id, action, result } }),
    onSuccess: refresh,
  });

  return (
    <section className="speakup-card space-y-4 p-5">
      <h2 className="font-heading text-base font-semibold text-navy">{t("emp.assignTitle")}</h2>

      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[220px] flex-1">
          <span className="mb-1.5 block text-xs font-semibold text-navy">{t("emp.assignee")}</span>
          <select value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass}>
            <option value="">{t("emp.notAssigned")}</option>
            {assignees.map((person) => (
              <option key={person.email} value={person.email}>
                {person.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => email && assignMutation.mutate()}
          disabled={!email || assignMutation.isPending}
          className="inline-flex h-[42px] items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {assignMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
          {t("emp.assignSave")}
        </button>
      </div>

      {item.assignee_name ? (
        <p className="text-[11px] text-muted-foreground">{t("emp.assignedTo", { name: item.assignee_name })}</p>
      ) : null}
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}

      {canReview ? (
        <div className="space-y-3 border-t border-border pt-3">
          <p className="text-xs font-semibold text-navy">{t("emp.reviewTitle")}</p>
          <input
            value={result}
            onChange={(event) => setResult(event.target.value)}
            placeholder={t("emp.reviewResultPh")}
            className={inputClass}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => reviewMutation.mutate("close")}
              disabled={reviewMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {reviewMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {t("emp.close")}
            </button>
            <button
              type="button"
              onClick={() => reviewMutation.mutate("return")}
              disabled={reviewMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-navy transition hover:border-primary hover:text-primary disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {t("emp.return")}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
