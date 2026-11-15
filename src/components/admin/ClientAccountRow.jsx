import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UserCheck, UserX } from "lucide-react";
import { setUserAccountStatus } from "@/lib/admin-fns";
import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/roles";

// An external client account: the administrator only switches its status.
export default function ClientAccountRow({ client }) {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const setStatus = useServerFn(setUserAccountStatus);
  const blocked = client.account_status === "blocked";

  const mutation = useMutation({
    mutationFn: () => setStatus({ data: { email: client.email, status: blocked ? "active" : "blocked" } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-users"] }),
  });

  return (
    <div className="speakup-card flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-navy">{client.full_name || client.email}</p>
        <p className="truncate text-[11px] text-muted-foreground">{client.email}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {t(`role.${client.org_role}`)} · {t("admin.registeredAt")}: {formatDate(client.created_date, lang)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
            blocked ? "bg-destructive/10 text-destructive" : "bg-[#20AFA4]/12 text-[#158078]"
          }`}
        >
          {blocked ? t("admin.blocked") : t("admin.active")}
        </span>
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition hover:border-primary/40 hover:text-primary disabled:opacity-50"
        >
          {blocked ? <UserCheck className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
          {blocked ? t("admin.activate") : t("admin.deactivate")}
        </button>
      </div>
    </div>
  );
}
