import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { addComment } from "@/lib/speakup-fns";
import { useI18n } from "@/lib/i18n";
import { formatDateTime } from "@/lib/roles";

export default function CommentsSection({ request, canManage, isAuthor }) {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const send = useServerFn(addComment);
  const [text, setText] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [clarify, setClarify] = useState(false);

  const refresh = () => {
    setText("");
    setClarify(false);
    queryClient.invalidateQueries({ queryKey: ["request", request.request.id] });
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const mutation = useMutation({
    mutationFn: (payload) => send({ data: payload }),
    onSuccess: refresh,
  });

  const submit = (event) => {
    event.preventDefault();
    if (!text.trim()) return;
    mutation.mutate({
      request_id: request.request.id,
      text: text.trim(),
      visibility: canManage ? visibility : "public",
      request_clarification: clarify,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {request.comments.length ? (
          request.comments.map((comment) => (
            <div
              key={comment.id}
              className={`rounded-xl border p-3.5 ${
                comment.visibility === "internal" ? "border-amber-300/50 bg-amber-50" : "border-border bg-card"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span className="font-semibold text-navy">{comment.author_name || "—"}</span>
                <span>· {formatDateTime(comment.created_date, lang)}</span>
                {comment.visibility === "internal" ? (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-700">{t("common.internal")}</span>
                ) : null}
                {comment.is_clarification ? (
                  <span className="rounded-full bg-[#0EA5E9]/15 px-2 py-0.5 font-semibold text-[#0369A1]">{t("request.clarify")}</span>
                ) : null}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{comment.text}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">{t("detail.noComments")}</p>
        )}
      </div>

      {canManage || isAuthor ? (
        <form onSubmit={submit} className="rounded-xl border border-border bg-muted/40 p-3.5">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={3}
            placeholder={clarify ? t("detail.clarifyPh") : t("detail.commentPh")}
            className="w-full resize-y rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {canManage ? (
              <>
                <select
                  value={visibility}
                  onChange={(event) => setVisibility(event.target.value)}
                  className="rounded-lg border border-input bg-card px-2.5 py-1.5 text-[11px] font-medium outline-none"
                >
                  <option value="public">{t("detail.publicOnly")}</option>
                  <option value="internal">{t("detail.internalOnly")}</option>
                </select>
                <button
                  type="button"
                  onClick={() => setClarify((v) => !v)}
                  className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${
                    clarify ? "border-[#0EA5E9] bg-[#0EA5E9]/10 text-[#0369A1]" : "border-border text-muted-foreground hover:text-navy"
                  }`}
                >
                  <MessageSquare className="mr-1 inline h-3 w-3" />
                  {t("request.clarify")}
                </button>
              </>
            ) : null}
            <button
              type="submit"
              disabled={mutation.isPending || !text.trim()}
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[11px] font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {mutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
              {t("detail.send")}
            </button>
          </div>
          {canManage && visibility === "internal" ? (
            <p className="mt-2 text-[10px] text-muted-foreground">{t("detail.internalHint")}</p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
