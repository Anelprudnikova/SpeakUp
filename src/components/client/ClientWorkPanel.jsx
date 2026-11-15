import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save } from "lucide-react";
import { updateClientWork } from "@/lib/client-fns";
import { useI18n } from "@/lib/i18n";

const inputClass =
  "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

const WORK_STATUSES = ["in_work", "awaiting_internal", "answer_ready"];

// The appointed employee works the client request: progress and a staff-only comment.
export default function ClientWorkPanel({ item }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const save = useServerFn(updateClientWork);
  const [status, setStatus] = useState(WORK_STATUSES.includes(item.status) ? item.status : "in_work");
  const [comment, setComment] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          id: item.id,
          status: status !== item.status ? status : undefined,
          comment: comment.trim() || undefined,
        },
      }),
    onSuccess: () => {
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["client-request", item.id] });
      queryClient.invalidateQueries({ queryKey: ["client-queue"] });
    },
  });

  return (
    <section className="speakup-card space-y-3 p-5">
      <h2 className="font-heading text-base font-semibold text-navy">{t("emp.workTitle")}</h2>

      <label className="block sm:max-w-xs">
        <span className="mb-1.5 block text-xs font-semibold text-navy">{t("client.status")}</span>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className={inputClass}>
          {WORK_STATUSES.map((value) => (
            <option key={value} value={value}>
              {t(`client.status.${value}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-navy">{t("emp.workComment")}</span>
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder={t("emp.workCommentPh")}
          rows={3}
          className="w-full resize-y rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
        />
      </label>

      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
      >
        {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
        {t("emp.save")}
      </button>
    </section>
  );
}
