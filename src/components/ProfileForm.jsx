import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2 } from "lucide-react";
import { updateProfile } from "@/lib/speakup-fns";
import { useI18n } from "@/lib/i18n";

const inputClass =
  "w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

export default function ProfileForm({ data }) {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const save = useServerFn(updateProfile);
  const [form, setForm] = useState({
    first_name: data?.first_name || "",
    last_name: data?.last_name || "",
    middle_name: data?.middle_name || "",
    position: data?.position || "",
    internal_enabled: data?.settings?.internal_enabled ?? true,
    email_enabled: data?.settings?.email_enabled ?? false,
    push_enabled: data?.settings?.push_enabled ?? false,
  });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!data) return;
    setForm({
      first_name: data.first_name || "",
      last_name: data.last_name || "",
      middle_name: data.middle_name || "",
      position: data.position || "",
      internal_enabled: data.settings?.internal_enabled ?? true,
      email_enabled: data.settings?.email_enabled ?? false,
      push_enabled: data.settings?.push_enabled ?? false,
    });
  }, [data]);

  const mutation = useMutation({
    mutationFn: (payload) => save({ data: payload }),
    onSuccess: () => {
      setError("");
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: () => {
      setSaved(false);
      setError(t("common.error"));
    },
  });

  const set = (key) => (event) => {
    setSaved(false);
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate(form);
      }}
      className="space-y-4"
    >
      <section className="speakup-card space-y-4 p-5 sm:p-6">
        <h2 className="font-heading text-base font-semibold text-navy">{t("profile.personal")}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-navy">{t("profile.lastName")}</span>
            <input value={form.last_name} onChange={set("last_name")} maxLength={80} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-navy">{t("profile.firstName")}</span>
            <input value={form.first_name} onChange={set("first_name")} maxLength={80} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-navy">{t("profile.middleName")}</span>
            <input value={form.middle_name} onChange={set("middle_name")} maxLength={80} className={inputClass} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-navy">{t("profile.position")}</span>
            <input value={form.position} onChange={set("position")} maxLength={200} className={inputClass} />
          </label>
        </div>
        <p className="text-[11px] text-muted-foreground">{t("profile.nameHint")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("admin.email")} value={data?.email || "—"} />
          <Field label={t("admin.department")} value={data?.department_name || "—"} />
        </div>
        <p className="text-[11px] text-muted-foreground">{t("profile.readOnlyHint")}</p>
      </section>

      <section className="speakup-card space-y-3 p-5 sm:p-6">
        <h2 className="font-heading text-base font-semibold text-navy">{t("profile.notifications")}</h2>
        <Toggle
          label={t("profile.internal")}
          checked={form.internal_enabled}
          onChange={(value) => setForm((prev) => ({ ...prev, internal_enabled: value }))}
        />
        <Toggle
          label={t("profile.email")}
          checked={form.email_enabled}
          onChange={(value) => setForm((prev) => ({ ...prev, email_enabled: value }))}
        />
        <Toggle
          label={t("profile.push")}
          checked={form.push_enabled}
          onChange={(value) => setForm((prev) => ({ ...prev, push_enabled: value }))}
        />
      </section>

      {error ? <p className="text-[11px] font-medium text-destructive">{error}</p> : null}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90 disabled:opacity-60"
        >
          {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {t("common.save")}
        </button>
        {saved ? <span className="text-[11px] font-medium text-[#158078]">{t("common.saved")}</span> : null}
      </div>
    </form>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-navy">{value}</p>
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-xl bg-muted/50 px-3.5 py-3">
      <span className="block text-xs font-semibold text-navy">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[#4263EB]"
      />
    </label>
  );
}
