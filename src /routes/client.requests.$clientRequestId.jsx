import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, FileText, Loader2, Send } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ClientStatusBadge from "@/components/client/ClientStatusBadge";
import ClientThread from "@/components/client/ClientThread";
import ClientDeleteRequest from "@/components/client/ClientDeleteRequest";
import { addClientMessage, getClientRequest } from "@/lib/client-fns";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/roles";

export const Route = createFileRoute("/client/requests/$clientRequestId")({
  head: () => ({ meta: [{ title: "SpeakUp — Обращение" }] }),
  component: ClientRequestDetailPage,
});

function ClientRequestDetailPage() {
  const { t, lang } = useI18n();
  const { clientRequestId } = Route.useParams();
  const queryClient = useQueryClient();
  const fetchRequest = useServerFn(getClientRequest);
  const sendMessage = useServerFn(addClientMessage);
  const [text, setText] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["client-request", clientRequestId],
    queryFn: () => fetchRequest({ data: { id: clientRequestId } }),
  });

  const mutation = useMutation({
    mutationFn: () => sendMessage({ data: { id: clientRequestId, text: text.trim() } }),
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["client-request", clientRequestId] });
      queryClient.invalidateQueries({ queryKey: ["client-notifications"] });
    },
  });

  function openFile(fileUri) {
    base44.integrations.Core.CreateFileSignedUrl({ file_uri: fileUri }).then(({ signed_url }) => {
      window.open(signed_url, "_blank", "noopener");
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.loading")}
      </div>
    );
  }
  if (!data || data.forbidden) {
    return (
      <div className="speakup-card px-4 py-12 text-center">
        <p className="text-sm font-medium text-navy">{data?.forbidden ? t("detail.forbidden") : t("client.notFound")}</p>
        <Link to="/client/requests" className="mt-3 inline-block text-xs font-semibold text-primary hover:underline">
          {t("client.back")}
        </Link>
      </div>
    );
  }

  const item = data.item;

  return (
    <div className="space-y-5">
      <Link to="/client/requests" className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-3.5 w-3.5" /> {t("client.back")}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] text-muted-foreground">{item.number}</p>
          <h1 className="mt-1 font-heading text-xl font-bold text-navy sm:text-2xl">{item.title}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {t(`client.type.${item.type}`)} · {formatDate(item.created_date, lang)}
          </p>
        </div>
        <ClientStatusBadge status={item.status} />
      </header>

      <section className="speakup-card space-y-3 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("client.description")}</h2>
        <p className="whitespace-pre-line text-sm leading-relaxed text-navy">{item.description}</p>
        {item.files?.length ? (
          <div>
            <p className="mb-1.5 text-xs font-semibold text-navy">{t("client.files")}</p>
            <ul className="flex flex-wrap gap-2">
              {item.files.map((file) => (
                <li key={file.file_uri}>
                  <button
                    type="button"
                    onClick={() => openFile(file.file_uri)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-[11px] text-navy hover:text-primary"
                  >
                    <FileText className="h-3.5 w-3.5" /> {file.file_name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {item.internal_request_number ? (
          <p className="rounded-lg bg-muted px-3 py-2 text-[11px] text-muted-foreground">
            {t("client.handoffInfo")} · {item.internal_request_number}
          </p>
        ) : null}
        {item.result ? (
          <div className="rounded-xl border border-[#20AFA4]/30 bg-[#20AFA4]/[0.07] px-3.5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#158078]">{t("client.internalResult")}</p>
            <p className="mt-1 whitespace-pre-line text-sm text-navy">{item.result}</p>
          </div>
        ) : null}
      </section>

      <section className="speakup-card space-y-3 p-5">
        <h2 className="font-heading text-base font-semibold text-navy">{t("client.messages")}</h2>
        <ClientThread messages={data.messages} />
        {data.closed ? (
          <p className="text-[11px] text-muted-foreground">{t("client.closedHint")}</p>
        ) : (
          <div className="flex items-end gap-2 border-t border-border pt-3">
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={t("client.replyPh")}
              rows={2}
              className="min-w-0 flex-1 resize-y rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => text.trim() && mutation.mutate()}
              disabled={mutation.isPending || !text.trim()}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-primary px-3.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
            >
              {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {t("client.send")}
            </button>
          </div>
        )}
      </section>

      {item.can_delete ? (
        <section className="speakup-card p-5">
          <ClientDeleteRequest request={item} />
        </section>
      ) : null}
    </div>
  );
}
