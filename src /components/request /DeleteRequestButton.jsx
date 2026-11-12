import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { deleteRequest } from "@/lib/speakup-fns";
import { useI18n } from "@/lib/i18n";

// Physical delete with a confirmation step; the server re-checks who may delete.
export default function DeleteRequestButton({ request }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const remove = useServerFn(deleteRequest);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => remove({ data: { id: request.id } }),
    onSuccess: () => {
      setError("");
      queryClient.removeQueries({ queryKey: ["request", request.id] });
      queryClient.invalidateQueries();
      navigate({ to: "/requests", replace: true });
    },
    onError: (err) => setError(err?.status === 403 ? t("detail.forbidden") : t("detail.deleteError")),
  });

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-muted-foreground transition hover:border-destructive/40 hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" /> {t("detail.deleteRequest")}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3.5">
      <p className="flex items-start gap-1.5 text-xs font-semibold text-destructive">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {t("detail.deleteRequest")}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-navy">{t("detail.deleteConfirm")}</p>
      {error ? <p className="mt-1 text-[11px] font-medium text-destructive">{error}</p> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-[11px] font-semibold text-destructive-foreground transition hover:bg-destructive/90 disabled:opacity-60"
        >
          {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          {t("common.delete")}
        </button>
        <button
          type="button"
          onClick={() => {
            setError("");
            setConfirming(false);
          }}
          disabled={mutation.isPending}
          className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground disabled:opacity-60"
        >
          {t("common.cancel")}
        </button>
      </div>
    </div>
  );
}
