import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, Loader2, Paperclip, Send, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { createRequest } from "@/lib/speakup-fns";
import { getFormOptions } from "@/lib/form-fns";
import { useI18n } from "@/lib/i18n";
import { PRIORITIES, TYPES, categoryName } from "@/lib/roles";

export const Route = createFileRoute("/_authed/requests/new")({
  head: () => ({ meta: [{ title: "SpeakUp — Новое обращение" }] }),
  component: NewRequestPage,
});

const initial = {
  title: "",
  description: "",
  proposed_solution: "",
  type: "",
  category_id: "",
  priority: "medium",
  attachments: [],
};

function NewRequestPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const fetchOptions = useServerFn(getFormOptions);
  const create = useServerFn(createRequest);
  const { data: options, isLoading } = useQuery({ queryKey: ["form-options"], queryFn: () => fetchOptions() });
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [uploading, setUploading] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const mutation = useMutation({
    mutationFn: (payload) => create({ data: payload }),
    onSuccess: (result) => {
      navigate({ to: "/requests/$requestId", params: { requestId: result.id } });
    },
    onError: () => setSubmitError(t("common.error")),
  });

  const categories = options?.categories || [];

  const set = (key) => (event) => {
    const value = event?.target ? event.target.value : event;
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const onFiles = async (event) => {
    const files = Array.from(event.target.files || []).slice(0, 5);
    if (!files.length) return;
    setUploading(true);
    const uploaded = [];
    for (const file of files) {
      try {
        const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
        uploaded.push({ file_name: file.name, file_uri, file_size: file.size });
      } catch {
        setSubmitError(t("common.error"));
      }
    }
    setForm((prev) => ({ ...prev, attachments: [...prev.attachments, ...uploaded].slice(0, 5) }));
    setUploading(false);
    event.target.value = "";
  };

  const submit = (event) => {
    event.preventDefault();
    const next = {};
    if (form.title.trim().length < 3) next.title = t("common.required");
    if (!form.type) next.type = t("common.required");
    if (!form.category_id) next.category_id = t("common.required");
    if (form.description.trim().length < 5) next.description = t("common.required");
    setErrors(next);
    if (Object.keys(next).length) return;
    setSubmitError("");
    mutation.mutate({
      title: form.title.trim(),
      description: form.description.trim(),
      proposed_solution: form.proposed_solution.trim(),
      type: form.type,
      category_id: form.category_id,
      priority: form.priority,
      attachments: form.attachments,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="font-heading text-2xl font-bold text-navy sm:text-3xl">{t("new.heading")}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t("new.sub")}</p>
      </header>

      <form onSubmit={submit} className="space-y-4">
        <section className="speakup-card space-y-4 p-5 sm:p-6">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-navy">
              {t("request.title")} <span className="text-destructive">*</span>
            </label>
            <input
              value={form.title}
              onChange={set("title")}
              placeholder={t("new.titlePh")}
              maxLength={200}
              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            {errors.title ? <p className="mt-1 text-[11px] font-medium text-destructive">{errors.title}</p> : null}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-navy">
              {t("request.type")} <span className="text-destructive">*</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => set("type")(type)}
                  className={`rounded-xl border px-3 py-2 text-xs font-medium transition ${
                    form.type === type
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-navy"
                  }`}
                >
                  {t(`type.${type}`)}
                </button>
              ))}
            </div>
            {errors.type ? <p className="mt-1 text-[11px] font-medium text-destructive">{errors.type}</p> : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-navy">
                {t("request.category")} <span className="text-destructive">*</span>
              </label>
              <select
                value={form.category_id}
                onChange={set("category_id")}
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
              >
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {categoryName(c, lang)}
                  </option>
                ))}
              </select>
              {errors.category_id ? <p className="mt-1 text-[11px] font-medium text-destructive">{errors.category_id}</p> : null}
            </div>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {t("request.departmentAuto")}
          </p>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-navy">
              {t("request.description")} <span className="text-destructive">*</span>
            </label>
            <textarea
              value={form.description}
              onChange={set("description")}
              placeholder={t("new.descPh")}
              rows={5}
              maxLength={5000}
              className="w-full resize-y rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            {errors.description ? <p className="mt-1 text-[11px] font-medium text-destructive">{errors.description}</p> : null}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-navy">
              {t("request.solution")} <span className="text-muted-foreground">({t("common.optional")})</span>
            </label>
            <textarea
              value={form.proposed_solution}
              onChange={set("proposed_solution")}
              placeholder={t("new.solutionPh")}
              rows={3}
              maxLength={5000}
              className="w-full resize-y rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
        </section>

        <section className="speakup-card space-y-4 p-5 sm:p-6">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-navy">{t("request.priority")}</label>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => set("priority")(p)}
                  className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                    form.priority === p
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:text-navy"
                  }`}
                >
                  {t(`prio.${p}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-navy">
              {t("request.attachments")} <span className="text-muted-foreground">({t("common.optional")})</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3.5 py-3 text-xs font-medium text-muted-foreground transition hover:border-primary/40 hover:text-primary">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
              {t("new.attach")}
              <input type="file" multiple className="hidden" onChange={onFiles} />
            </label>
            {form.attachments.length ? (
              <ul className="mt-2 space-y-1.5">
                {form.attachments.map((a, index) => (
                  <li key={a.file_uri} className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-[11px]">
                    <span className="truncate">{a.file_name}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((prev) => ({ ...prev, attachments: prev.attachments.filter((_, i) => i !== index) }))
                      }
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>

        {submitError ? (
          <p className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3.5 py-2.5 text-xs font-medium text-destructive">
            <AlertCircle className="h-4 w-4" /> {submitError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={mutation.isPending || uploading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90 disabled:opacity-60 sm:w-auto"
        >
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {t("new.submit")}
        </button>
      </form>
    </div>
  );
}
