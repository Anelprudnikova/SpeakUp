import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Lock, Send, UserRound } from "lucide-react";
import { replyClientRequest } from "@/lib/client-fns";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// The head of the department and the appointed executor answer the client here.
// A public answer goes into the client's own conversation; an internal note stays
// among the staff. Both are stored on the same client request.
export default function ClientReplyPanel({ item }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const send = useServerFn(replyClientRequest);
  const [mode, setMode] = useState("public");
  const [text, setText] = useState("");

  const mutation = useMutation({
    mutationFn: () => send({ data: { id: item.id, text: text.trim(), visibility: mode } }),
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["client-request", item.id] });
      queryClient.invalidateQueries({ queryKey: ["client-queue"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["client-notifications"] });
    },
  });

  const isPublic = mode === "public";

  return (
    <section className="speakup-card space-y-3 p-5">
      <h2 className="font-heading text-base font-semibold text-navy">{t("client.replyTitle")}</h2>

      <div className="inline-flex rounded-xl bg-muted p-1">
        <button
          type="button"
          onClick={() => setMode("public")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
            isPublic ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-navy"
          )}
        >
          <UserRound className="h-3.5 w-3.5" /> {t("mgr.reply")}
        </button>
        <button
          type="button"
          onClick={() => setMode("internal")}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition",
            !isPublic ? "bg-card text-[#7957E8] shadow-sm" : "text-muted-foreground hover:text-navy"
          )}
        >
          <Lock className="h-3.5 w-3.5" /> {t("mgr.internalNote")}
        </button>
      </div>

      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={3}
        placeholder={isPublic ? t("mgr.replyPh") : t("mgr.internalNoteHint")}
        className={cn(
          "w-full resize-y rounded-xl px-3.5 py-2.5 text-sm outline-none transition",
          isPublic
            ? "border border-input bg-background focus:border-primary"
            : "border border-dashed border-[#7957E8]/40 bg-[#7957E8]/[0.03] focus:border-[#7957E8]"
        )}
      />

      <p className="text-[11px] text-muted-foreground">
        {isPublic ? t("client.replyPublicHint") : t("mgr.internalNoteHint")}
      </p>

      <button
        type="button"
        onClick={() => text.trim() && mutation.mutate()}
        disabled={mutation.isPending || !text.trim()}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold transition disabled:opacity-50",
          isPublic
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "border border-[#7957E8]/40 bg-[#7957E8]/10 text-[#5936C9] hover:bg-[#7957E8]/15"
        )}
      >
        {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        {t("client.send")}
      </button>
    </section>
  );
}
