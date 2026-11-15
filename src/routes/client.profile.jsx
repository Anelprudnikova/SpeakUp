import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save } from "lucide-react";
import { getClientProfile, updateClientProfile } from "@/lib/client-fns";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/client/profile")({
  head: () => ({ meta: [{ title: "SpeakUp — Профиль" }] }),
  component: ClientProfilePage,
});

function ClientProfilePage() {
  const { t } = useI18n();
  const fetchProfile = useServerFn(getClientProfile);
  const save = useServerFn(updateClientProfile);
  const { data, isLoading } = useQuery({ queryKey: ["client-profile"], queryFn: () => fetchProfile() });
  const [form, setForm] = useState({ first_name: "", last_name: "" });

  useEffect(() => {
    if (!data) return;
    setForm({ first_name: data.first_name || "", last_name: data.last_name || "" });
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => save({ data: { first_name: form.first_name.trim(), last_name: form.last_name.trim() } }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-heading text-2xl font-bold text-navy sm:text-3xl">{t("client.profileHeading")}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t("client.profileSub")}</p>
      </header>

      <section className="speakup-card space-y-4 p-5 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-navy">{t("client.firstName")}</span>
            <input
              value={form.first_name}
              onChange={(event) => setForm((prev) => ({ ...prev, first_name: event.target.value }))}
              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-navy">{t("client.lastName")}</span>
            <input
              value={form.last_name}
              onChange={(event) => setForm((prev) => ({ ...prev, last_name: event.target.value }))}
              className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none focus:border-primary"
            />
          </label>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-navy">{t("client.email")}</span>
          <input
            value={data?.email || ""}
            readOnly
            className="w-full rounded-xl border border-input bg-muted px-3.5 py-2.5 text-sm text-muted-foreground outline-none"
          />
        </label>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => form.first_name.trim() && form.last_name.trim() && mutation.mutate()}
            disabled={mutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {t("client.save")}
          </button>
          {mutation.isSuccess ? <p className="text-[11px] font-medium text-[#158078]">{t("client.saved")}</p> : null}
        </div>
      </section>
    </div>
  );
}
