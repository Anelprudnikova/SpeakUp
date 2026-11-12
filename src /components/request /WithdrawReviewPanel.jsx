import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Undo2 } from "lucide-react";
import { updateRequest } from "@/lib/speakup-fns";
import { useI18n } from "@/lib/i18n";

// The executor submitted the work by mistake or found something to fix while the
// head has not decided yet: he takes the request back and continues the work.
export default function WithdrawReviewPanel({ request }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const save = useServerFn(updateRequest);
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => save({ data: { id: request.id, status: "inProgress" } }),
    onSuccess: () => {
      setError("");
      queryClient.invalidateQueries({ queryKey: ["request", request.id] });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      queryClient.invalidateQueries({ queryKey: ["assigned"] });
      queryClient.invalidateQueries({ queryKey: ["review"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => setError(t("common.error")),
  });

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="inline-flex items-center gap-2 rounded-xl border border-[#F97316]/40 bg-[#F97316]/10 px-4 py-2.5 text-xs font-semibold text-[#C2410C] transition hover:bg-[#F97316]/15 disabled:opacity-60"
      >
        {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" />}
        {t("detail.withdrawAction")}
      </button>
      {error ? <p className="text-[11px] font-medium text-destructive">{error}</p> : null}
    </div>
  );
}
