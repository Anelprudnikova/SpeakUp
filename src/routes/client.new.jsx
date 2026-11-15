import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, Loader2, Paperclip, Send, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { createClientRequest } from "@/lib/client-fns";
import { useI18n } from "@/lib/i18n";
import { CLIENT_TYPES } from "@/lib/roles";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/client/new")({
  head: () => ({ meta: [{ title: "SpeakUp — Новое обращение" }] }),
  component: NewClientRequestPage,
});

function NewClientRequestPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const submit = useServerFn(createClientRequest);
  const [form, setForm] = useState({ type: "question", title: "", description: "", files: [] });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      submit({
        data: {
          type: form.type,
          title: form.title.trim(),
          description: form.description.trim(),
          files: form.files,
        },
      }),
    onSuccess: (result) => navigate({ to: "/client/requests/$clientRequestId", params: { clientRequestId: result.id } }),
    onError: () => setError(t("common.error")),
  });

  async function onFiles(event) {
    const picked = Array.from(event.target.files || []);
    if (!picked.length) return;
    setUploading(true);
    try {
      const uploaded = [];
      for (const file of picked.slice(0, 5)) {
        const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
        uploaded.push({ file_name: file.name, file_uri });
      }
      setForm((prev) => ({ ...prev, files: [...prev.files, ...uploaded].slice(0, 5) }));
    } catch {
      setError(t("common.error"));
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-heading text-2xl font-bold text-navy sm:text-3xl">{t("client.newHeading")}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t("client.newSub")}</p>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          mutation.mutate();
        }}
        className="speakup-card space-y-4 p-5 sm:p-6"
      >
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-navy">{t("client.type")}</label>
          <div className="flex flex-wrap gap-2">
            {CLIENT_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, type }))}
                className={cn(
                  "rounded-xl border px-3 py-2 text-xs font-medium transition",
                  form.type === type ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-navy"
                )}
              >
                {t(`client.type.${type}`)}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-navy">{t("client.titleField")}</span>
          <input
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder={t("client.titlePh")}
            required
            minLength={3}
            maxLength={200}
            className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-navy">{t("client.description")}</span>
          <textarea
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            placeholder={t("client.descriptionPh")}
            required
            minLength={5}
            rows={6}
            className="w-full resize-y rounded-xl border border-input bg-background px-3.5 py-3 text-sm outline-none focus:border-primary"
          />
        </label>

        <div>
          <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3.5 py-2.5 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-primary">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
            {t("client.attach")}
            <input type="file" multiple className="hidden" onChange={onFiles} disabled={uploading} />
          </label>
          {form.files.length ? (
            <ul className="mt-2 space-y-1.5">
              {form.files.map((file) => (
                <li key={file.file_uri} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-[11px]">
                  <span className="truncate">{file.file_name}</span>
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, files: prev.files.filter((f) => f.file_uri !== file.file_uri) }))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {error ? (
          <p className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3.5 py-2.5 text-xs font-medium text-destructive">
            <AlertCircle className="h-4 w-4" /> {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={mutation.isPending || uploading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60 sm:w-auto"
        >
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {mutation.isPending ? t("client.sending") : t("client.submit")}
        </button>
      </form>
    </div>
  );
}
