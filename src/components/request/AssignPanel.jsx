import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, Loader2, Save, UserPlus } from "lucide-react";
import { updateRequest } from "@/lib/speakup-fns";
import { useI18n } from "@/lib/i18n";
import { PRIORITIES } from "@/lib/roles";

const inputClass =
  "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

// The department head distributes the request: executor, deadline and priority.
export default function AssignPanel({ request, assignees, disabled = false }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const save = useServerFn(updateRequest);
  const [form, setForm] = useState({
    assignee_email: request.assignee_email || "",
    due_date: request.due_date ? request.due_date.slice(0, 10) : "",
    priority: request.priority || "medium",
  });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          id: request.id,
          assignee_email: form.assignee_email,
          due_date: form.due_date ? new Date(`${form.due_date}T12:00:00`).toISOString() : "",
          priority: form.priority,
        },
      }),
    onSuccess: () => {
      setError("");
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["request", request.id] });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      queryClient.invalidateQueries({ queryKey: ["distribution"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err) => {
      setSaved(false);
      setError(err?.status === 400 ? t("detail.assigneeOutOfDepartment") : t("common.error"));
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setSaved(false);
        mutation.mutate();
      }}
      className="space-y-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <UserPlus className="h-3.5 w-3.5" /> {t("request.assignee")}
          </span>
          <select
            value={form.assignee_email}
            onChange={(event) => setForm((prev) => ({ ...prev, assignee_email: event.target.value }))}
            disabled={disabled}
            className={inputClass}
          >
            <option value="">— {t("detail.notAssigned")}</option>
            {assignees.map((person) => (
              <option key={person.email} value={person.email}>
                {person.name}
                {person.position ? ` · ${person.position}` : ""}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[11px] text-muted-foreground">{t("detail.assigneeHint")}</span>
        </label>

        <label className="block">
          <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" /> {t("request.due")}
          </span>
          <input
            type="date"
            value={form.due_date}
            onChange={(event) => setForm((prev) => ({ ...prev, due_date: event.target.value }))}
            disabled={disabled}
            className={inputClass}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("request.priority")}
          </span>
          <select
            value={form.priority}
            onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))}
            disabled={disabled}
            className={inputClass}
          >
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {t(`prio.${priority}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <p className="text-[11px] font-medium text-destructive">{error}</p> : null}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
        >
          {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {t("detail.saveChanges")}
        </button>
        {saved ? <span className="text-[11px] font-medium text-[#158078]">{t("common.saved")}</span> : null}
      </div>
    </form>
  );
}
