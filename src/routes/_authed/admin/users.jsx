import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search } from "lucide-react";
import UserAccessCard from "@/components/admin/UserAccessCard";
import ClientAccountRow from "@/components/admin/ClientAccountRow";
import { listAdminUsers } from "@/lib/admin-fns";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authed/admin/users")({
  head: () => ({ meta: [{ title: "SpeakUp — Пользователи" }] }),
  component: AdminUsersPage,
});

const TABS = [
  { key: "admin", label: "admin.tabAdmins", client: false },
  { key: "head", label: "admin.tabHeads", client: false },
  { key: "employee", label: "admin.tabEmployees", client: false },
  { key: "client_manager", label: "admin.tabManagers", client: false },
  { key: "client", label: "admin.tabClients", client: true },
];

function inTab(user, tab) {
  if (tab.client) return user.account_type === "client";
  return user.account_type !== "client" && user.org_role === tab.key;
}

function AdminUsersPage() {
  const { t } = useI18n();
  const fetchUsers = useServerFn(listAdminUsers);
  const { data, isLoading, error } = useQuery({ queryKey: ["admin-users"], queryFn: () => fetchUsers(), retry: false });
  const [tab, setTab] = useState("employee");
  const [search, setSearch] = useState("");
  const users = data?.users || [];
  const departments = data?.departments || [];

  if (error) return <p className="speakup-card p-6 text-sm text-muted-foreground">{t("mgr.forbidden")}</p>;

  const activeTab = TABS.find((item) => item.key === tab) || TABS[2];
  const q = search.trim().toLowerCase();
  const visible = users
    .filter((user) => inTab(user, activeTab))
    .filter((user) => !q || [user.full_name, user.email].some((value) => (value || "").toLowerCase().includes(q)));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-heading text-2xl font-bold text-navy sm:text-3xl">{t("admin.users")}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t("admin.usersSub")}</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((item) => {
          const count = users.filter((user) => inTab(user, item)).length;
          const active = item.key === activeTab.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-navy"
              }`}
            >
              {t(item.label)}
              <span className={`rounded-full px-1.5 text-[10px] font-bold ${active ? "bg-primary/15" : "bg-muted"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <label className="relative block sm:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("admin.searchUsers")}
          className="w-full rounded-xl border border-input bg-background py-2.5 pl-9 pr-3 text-xs outline-none focus:border-primary"
        />
      </label>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.loading")}
        </div>
      ) : visible.length ? (
        <div className="space-y-3">
          {visible.map((user) =>
            activeTab.client ? (
              <ClientAccountRow key={user.id} client={user} />
            ) : (
              <UserAccessCard key={user.id} user={user} departments={departments} />
            )
          )}
        </div>
      ) : (
        <div className="speakup-card px-6 py-14 text-center text-sm text-muted-foreground">{t("admin.emptyTab")}</div>
      )}
    </div>
  );
}
