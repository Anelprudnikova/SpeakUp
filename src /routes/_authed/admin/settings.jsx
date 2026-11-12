import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save } from "lucide-react";
import { getAppSettings, saveAppSettings } from "@/lib/admin-fns";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authed/admin/settings")({
  head: () => ({ meta: [{ title: "SpeakUp — Настройки" }] }),
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fetchSettings = useServerFn(getAppSettings);
  const save = useServerFn(saveAppSettings);
  const { data, isLoading } = useQuery({ queryKey: ["app-settings"], queryFn: () => fetchSettings() });
  const [form, setForm] = useState({
    sla_first_response_days: 3,
    sla_resolution_days: 10,
    company_name: "Модус Трейд",
  });

  useEffect(() => {
    if (!data?.settings) return;
    setForm({
      sla_first_response_days: data.settings.sla_first_response_days ?? 3,
      sla_resolution_days: data.settings.sla_resolution_days ?? 10,
      company_name: data.settings.company_name || "Модус Трейд",
    });
  }, [data]);

  const mutation = useMutation({
    mutationFn: () => save({ data: form }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["app-settings"] }),
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
        <h1 className="font-heading text-2xl font-bold text-navy sm:text-3xl">{t("nav.settings")}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t("admin.settingsSub")}</p>
      </header>

      <section className="speakup-card space-y-4 p-5 sm:p-6">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{t("admin.slaFirst")}</span>
          <input
            type="number"
            min={1}
            max={60}
            value={form.sla_first_response_days}
            onChange={(event) => setForm((prev) => ({ ...prev, sla_first_response_days: Number(event.target.value) }))}
            className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary sm:max-w-xs"
          />
          <span className="mt-1.5 block text-[11px] leading-relaxed text-muted-foreground">{t("admin.slaFirstHint")}</span>
        </label>

        <p className="rounded-xl bg-muted/60 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
          {t("admin.slaResolutionHint")}
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {t("common.save")}
          </button>
          {mutation.isSuccess ? <p className="text-[11px] font-medium text-[#158078]">{t("common.saved")}</p> : null}
        </div>
      </section>
    </div>
  );
}
