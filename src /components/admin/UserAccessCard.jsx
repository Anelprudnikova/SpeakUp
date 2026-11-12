import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Pencil, Save, Trash2, UserCheck, UserX } from "lucide-react";
import { deleteUserAccount, setUserAccountStatus, updateUserAccess } from "@/lib/admin-fns";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/roles";

// One list of roles for both selects: the role is the same value in each field.
const ROLE_OPTIONS = [
  { value: "employee", label: "role.employee" },
  { value: "admin", label: "role.admin" },
  { value: "head", label: "role.head" },
  { value: "client_manager", label: "role.client_manager" },
];

function roleOf(user) {
  if (["employee", "admin", "head", "client_manager"].includes(user.system_role)) return user.system_role;
  if (["employee", "admin", "head", "client_manager"].includes(user.access_level)) return user.access_level;
  if (user.staff_role === "chief" || user.staff_role === "manager") return "head";
  return "employee";
}

export default function UserAccessCard({ user, departments }) {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const save = useServerFn(updateUserAccess);
  const setStatus = useServerFn(setUserAccountStatus);
  const removeUser = useServerFn(deleteUserAccount);

  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [form, setForm] = useState({
    org_role: roleOf(user),
    department_id: user.department_id || "",
    position: user.position || "",
    account_status: user.account_status || "active",
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    queryClient.invalidateQueries({ queryKey: ["admin-departments"] });
  };
  const saveMutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          email: user.email,
          org_role: form.org_role,
          department_id: form.department_id,
          position: form.position,
          account_status: form.account_status,
        },
      }),
    onSuccess: () => {
      setOpen(false);
      refresh();
    },
  });
  const statusMutation = useMutation({
    mutationFn: (status) => setStatus({ data: { email: user.email, status } }),
    onSuccess: () => {
      setConfirm(null);
      refresh();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => removeUser({ data: { email: user.email } }),
    onSuccess: () => {
      setConfirm(null);
      refresh();
    },
  });

  const blocked = user.account_status === "blocked";
  const busy = statusMutation.isPending || deleteMutation.isPending;
  const role = roleOf(user);

  return (
    <div className="speakup-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-navy">{user.full_name || user.email}</p>
          <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t(`role.${role}`)}
            {user.department_name ? ` · ${user.department_name}` : ""}
            {user.position ? ` · ${user.position}` : ""}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {t("admin.registeredAt")}: {formatDate(user.created_date, lang)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
              blocked ? "bg-destructive/10 text-destructive" : "bg-[#20AFA4]/12 text-[#158078]"
            }`}
          >
            {blocked ? t("admin.blocked") : t("admin.active")}
          </span>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-navy transition hover:border-primary/40 hover:text-primary"
          >
            <Pencil className="h-3.5 w-3.5" /> {t("admin.edit")}
          </button>
          <button
            type="button"
            onClick={() => setConfirm(blocked ? "activate" : "deactivate")}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition hover:border-[#F59E0B]/40 hover:text-[#B45309]"
          >
            {blocked ? <UserCheck className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
            {blocked ? t("admin.activate") : t("admin.deactivate")}
          </button>
          <button
            type="button"
            onClick={() => setConfirm("delete")}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition hover:border-destructive/40 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" /> {t("admin.deleteUser")}
          </button>
        </div>
      </div>

      {open ? (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">{t("admin.accessLevel")}</span>
              <select
                value={form.org_role}
                onChange={(event) => setForm((prev) => ({ ...prev, org_role: event.target.value }))}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role.value} value={role.value}>
                    {t(role.label)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">{t("admin.systemRole")}</span>
              <select
                value={form.org_role}
                onChange={(event) => setForm((prev) => ({ ...prev, org_role: event.target.value }))}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role.value} value={role.value}>
                    {t(role.label)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">{t("admin.department")}</span>
              <select
                value={form.department_id}
                onChange={(event) => setForm((prev) => ({ ...prev, department_id: event.target.value }))}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
              >
                <option value="">—</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">{t("admin.position")}</span>
              <input
                value={form.position}
                onChange={(event) => setForm((prev) => ({ ...prev, position: event.target.value }))}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">{t("admin.status")}</span>
              <select
                value={form.account_status}
                onChange={(event) => setForm((prev) => ({ ...prev, account_status: event.target.value }))}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:border-primary"
              >
                <option value="active">{t("admin.active")}</option>
                <option value="blocked">{t("admin.blocked")}</option>
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {t("common.save")}
          </button>
        </div>
      ) : null}

      {confirm ? (
        <div className="mt-3 rounded-xl border border-border bg-muted/40 p-3">
          <p className="text-[11px] leading-relaxed text-navy">
            {confirm === "delete" ? t("admin.confirmDelete") : t("admin.confirmDeactivate")}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => (confirm === "delete" ? deleteMutation.mutate() : statusMutation.mutate(confirm === "activate" ? "active" : "blocked"))}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-[11px] font-semibold text-destructive-foreground transition hover:bg-destructive/90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {t("admin.confirm")}
            </button>
            <button
              type="button"
              onClick={() => setConfirm(null)}
              className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold text-muted-foreground"
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
