import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Hand, Loader2 } from "lucide-react";
import { updateRequest } from "@/lib/speakup-fns";
import { useI18n } from "@/lib/i18n";

// The head either assigns someone else or takes this request himself.
export default function SelfExecuteBar({ request, email, active }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const save = useServerFn(updateRequest);

  const mutation = useMutation({
    mutationFn: () => save({ data: { id: request.id, assignee_email: email } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["request", request.id] });
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      queryClient.invalidateQueries({ queryKey: ["distribution"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  if (active) {
    return (
      <div className="mb-3 flex items-start gap-2 rounded-xl bg-[#7957E8]/[0.08] px-3.5 py-2.5">
        <Hand className="mt-0.5 h-4 w-4 shrink-0 text-[#7957E8]" />
        <p className="text-[11px] font-medium leading-relaxed text-[#5B3FC4]">{t("detail.selfExecuteActive")}</p>
      </div>
    );
  }

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="inline-flex items-center gap-2 rounded-xl border border-[#7957E8]/40 px-3.5 py-2 text-xs font-semibold text-[#5B3FC4] transition hover:bg-[#7957E8]/10 disabled:opacity-60"
      >
        {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Hand className="h-3.5 w-3.5" />}
        {t("detail.selfExecute")}
      </button>
      <p className="mt-1.5 text-[11px] text-muted-foreground">{t("detail.selfExecuteHint")}</p>
    </div>
  );
}
