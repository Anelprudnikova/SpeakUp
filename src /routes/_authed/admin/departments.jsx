import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, Trash2, X } from "lucide-react";
import { adminListDepartments, deleteDepartment, saveDepartment } from "@/lib/admin-fns";
import DepartmentHeadsPicker from "@/components/admin/DepartmentHeadsPicker";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authed/admin/departments")({
  head: () => ({ meta: [{ title: "SpeakUp — Подразделения" }] }),
  component: AdminDepartmentsPage,
});

const EMPTY = { id: "", name: "", description: "", manager_emails: [] };

function AdminDepartmentsPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const fetchDepartments = useServerFn(adminListDepartments);
  const save = useServerFn(saveDepartment);
  const remove = useServerFn(deleteDepartment);
  const { data, isLoading } = useQuery({ queryKey: ["admin-departments"], queryFn: () => fetchDepartments() });
  const [form, setForm] = useState(EMPTY);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-departments"] });
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  };
  const saveMutation = useMutation({ mutationFn: (payload) => save({ data: payload }), onSuccess: () => { setForm(EMPTY); refresh(); } });
  const deleteMutation = useMutation({ mutationFn: (id) => remove({ data: { id } }), onSuccess: refresh });

  const toggleHead = (email) =>
    setForm((prev) => ({
      ...prev,
      manager_emails: prev.manager_emails.includes(email)
        ? prev.manager_emails.filter((value) => value !== email)
        : [...prev.manager_emails, email],
    }));

  const nameOf = (email) => (data?.users || []).find((user) => user.email === email)?.name || email;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-heading text-2xl font-bold text-navy sm:text-3xl">{t("nav.departments")}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t("admin.departmentsSub")}</p>
      </header>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (form.name.trim().length < 2) return;
          saveMutation.mutate({ ...form, id: form.id || undefined });
        }}
        className="speakup-card space-y-3 p-4 sm:p-5"
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {form.id ? t("common.edit") : t("admin.addDepartment")}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder={t("admin.departmentName")} className="rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary" />
          <input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder={t("admin.description")} className="rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary" />
        </div>

        <DepartmentHeadsPicker
          people={data?.people || []}
          selected={form.manager_emails}
          onToggle={toggleHead}
          nameOf={nameOf}
        />

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
          {(data?.items || []).map((department) => {
            const heads = Array.isArray(department.manager_emails) && department.manager_emails.length
              ? department.manager_emails
              : [department.manager_email].filter(Boolean);
            const headNames = heads
              .map((email) => (data?.users || []).find((u) => u.email === email)?.name || email)
              .join(", ");
            return (
              <div key={department.id} className="speakup-card flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy">{department.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {headNames || t("admin.noHead")}
                    {department.is_active === false ? ` · ${t("admin.blocked")}` : ""}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        id: department.id,
                        name: department.name,
                        description: department.description || "",
                        manager_emails: heads,
                      })
                    }
                    className="rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-navy hover:border-primary/40 hover:text-primary"
                  >
                    {t("common.edit")}
                  </button>
                  <button type="button" onClick={() => deleteMutation.mutate(department.id)} className="rounded-lg border border-border p-1.5 text-muted-foreground hover:border-destructive/40 hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
