import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, Trash2, X } from "lucide-react";
import { adminListCategories, deleteCategory, saveCategory } from "@/lib/admin-fns";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authed/admin/categories")({
  head: () => ({ meta: [{ title: "SpeakUp — Категории" }] }),
  component: AdminCategoriesPage,
});

const EMPTY = { id: "", key: "", name_ru: "", name_kk: "", name_en: "", description: "", department_id: "" };

function AdminCategoriesPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fetchCategories = useServerFn(adminListCategories);
  const save = useServerFn(saveCategory);
  const remove = useServerFn(deleteCategory);
  const { data, isLoading } = useQuery({ queryKey: ["admin-categories"], queryFn: () => fetchCategories() });
  const [form, setForm] = useState(EMPTY);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
  const saveMutation = useMutation({
    mutationFn: (payload) => save({ data: payload }),
    onSuccess: () => {
      setForm(EMPTY);
      refresh();
    },
  });
  const deleteMutation = useMutation({ mutationFn: (id) => remove({ data: { id } }), onSuccess: refresh });

  const departments = data?.departments || [];
  const departmentName = (id) => departments.find((d) => d.id === id)?.name || "—";

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-heading text-2xl font-bold text-navy sm:text-3xl">{t("nav.categories")}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t("admin.categoriesSub")}</p>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (form.name_ru.trim().length < 2 || form.key.trim().length < 2) return;
          saveMutation.mutate({ ...form, id: form.id || undefined });
        }}
        className="speakup-card space-y-3 p-4 sm:p-5"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {form.id ? t("common.edit") : t("admin.addCategory")}
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input value={form.key} onChange={(e) => setForm((p) => ({ ...p, key: e.target.value }))} placeholder="key" className="rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary" />
          <input value={form.name_ru} onChange={(e) => setForm((p) => ({ ...p, name_ru: e.target.value }))} placeholder="Русский" className="rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary" />
          <input value={form.name_kk} onChange={(e) => setForm((p) => ({ ...p, name_kk: e.target.value }))} placeholder="Қазақша" className="rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary" />
          <input value={form.name_en} onChange={(e) => setForm((p) => ({ ...p, name_en: e.target.value }))} placeholder="English" className="rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary" />
        </div>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t("admin.routedDepartment")}
          </span>
          <select
            value={form.department_id}
            onChange={(e) => setForm((p) => ({ ...p, department_id: e.target.value }))}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary sm:max-w-sm"
          >
            <option value="">—</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[11px] text-muted-foreground">{t("admin.routedDepartmentHint")}</span>
        </label>
        <div className="flex gap-2">
          <button type="submit" disabled={saveMutation.isPending} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50">
            {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {t("common.save")}
          </button>
          {form.id ? (
            <button type="button" onClick={() => setForm(EMPTY)} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
              <X className="h-3.5 w-3.5" /> {t("common.cancel")}
            </button>
          ) : null}
        </div>
      </form>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.loading")}
        </div>
      ) : (
        <div className="space-y-2">
          {(data?.items || []).map((category) => (
            <div key={category.id} className="speakup-card flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-navy">{category.name_ru}</p>
                <p className="text-[11px] text-muted-foreground">
                  {[category.name_kk, category.name_en].filter(Boolean).join(" · ")} · <span className="font-mono">{category.key}</span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t("admin.routedDepartment")}: {category.department_id ? departmentName(category.department_id) : t("admin.notRouted")}
                  {category.is_active === false ? ` · ${t("admin.blocked")}` : ""}
                </p>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      id: category.id,
                      key: category.key,
                      name_ru: category.name_ru,
                      name_kk: category.name_kk || "",
                      name_en: category.name_en || "",
                      description: category.description || "",
                      department_id: category.department_id || "",
                    })
                  }
                  className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-navy hover:border-primary/40 hover:text-primary"
                >
                  {t("common.edit")}
                </button>
                <button type="button" onClick={() => deleteMutation.mutate(category.id)} className="rounded-lg border border-border p-1.5 text-muted-foreground hover:border-destructive/40 hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
