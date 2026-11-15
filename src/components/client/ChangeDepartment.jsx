import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Check, Loader2, X } from "lucide-react";
import { changeClientDepartment } from "@/lib/client-fns";
import { useI18n } from "@/lib/i18n";

// Moves the request to another department in place: the card, its number, the
// conversation and the client stay; only the receiving head changes.
export default function ChangeDepartment({ item, departments = [] }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const change = useServerFn(changeClientDepartment);
  const [open, setOpen] = useState(false);
  const [departmentId, setDepartmentId] = useState(item.department_id || "");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => change({ data: { id: item.id, department_id: departmentId } }),
    onSuccess: (result) => {
      if (!result?.ok) {
        setError(result?.reason === "no_head" ? t("mgr.changeNoHead") : t("common.error"));
        return;
      }
      setError("");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["client-request", item.id] });
      queryClient.invalidateQueries({ queryKey: ["client-queue"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: () => setError(t("common.error")),
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setDepartmentId(item.department_id || "");
          setError("");
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-card px-2.5 py-1 text-[11px] font-semibold text-primary transition hover:bg-primary/10"
      >
        <Building2 className="h-3 w-3" /> {t("mgr.changeDepartment")}
      </button>
    );
  }

  return (
    <div className="w-full space-y-2 rounded-xl border border-primary/30 bg-card p-2.5">
      <p className="text-[11px] font-semibold text-navy">{t("mgr.changeDepartmentHint")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={departmentId}
          onChange={(event) => setDepartmentId(event.target.value)}
          className="min-w-[190px] flex-1 rounded-lg border border-input bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary"
        >
          {departments.map((department) => (
            <option key={department.id} value={department.id} disabled={!department.has_head}>
              {department.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !departmentId || departmentId === item.department_id}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {mutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          {t("mgr.changeConfirm")}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={mutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold text-navy transition hover:border-primary hover:text-primary disabled:opacity-50"
        >
          <X className="h-3 w-3" /> {t("common.cancel")}
        </button>
      </div>
      {error ? <p className="text-[11px] text-destructive">{error}</p> : null}
    </div>
  );
}
