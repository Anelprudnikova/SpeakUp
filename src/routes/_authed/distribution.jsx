import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search, SlidersHorizontal } from "lucide-react";
import { getDistribution } from "@/lib/speakup-fns";
import { useI18n } from "@/lib/i18n";
import { PRIORITIES, WORKFLOW_STATUSES, categoryName } from "@/lib/roles";
import RequestCard from "@/components/RequestCard";

export const Route = createFileRoute("/_authed/distribution")({
  head: () => ({ meta: [{ title: "SpeakUp — Распределение обращений" }] }),
  component: DistributionPage,
});

const EMPTY = {
  status: "",
  category_id: "",
  department_id: "",
  priority: "",
  assignee_email: "",
  date_from: "",
  date_to: "",
  q: "",
  sort: "new",
  include_deleted: false,
};

function DistributionPage() {
  const { t, lang } = useI18n();
  const [filters, setFilters] = useState(EMPTY);
  const fetchDistribution = useServerFn(getDistribution);

  const payload = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value) payload[key] = value;
  });

  const { data, isLoading } = useQuery({
    queryKey: ["distribution", payload],
    queryFn: () => fetchDistribution({ data: payload }),
  });

  const set = (key) => (event) => setFilters((prev) => ({ ...prev, [key]: event.target.value }));
  const counts = data?.counts || {};
  const options = data?.options || {};
  const active = Object.entries(filters).some(([key, value]) => value && key !== "sort");

  const chips = [
    { value: "", label: t("dist.all"), count: counts.all ?? 0 },
    ...WORKFLOW_STATUSES.map((status) => ({
      value: status,
      label: t(`status.${status}`),
      count: counts[status] ?? 0,
    })),
    { value: "__unassigned__", label: `${t("dist.filterAssignee")}: —`, count: counts.unassigned ?? 0 },
  ];
  if (data?.viewer?.role === "admin") {
    chips.push({ value: "__deleted__", label: t("detail.deletedBadge"), count: counts.deleted ?? 0 });
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-heading text-2xl font-bold text-navy sm:text-3xl">{t("dist.heading")}</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{t("dist.sub")}</p>
      </header>

      <section className="speakup-card space-y-3 p-4">
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => {
            const selected =
              chip.value === "__unassigned__"
                ? filters.assignee_email === "__none__"
                : chip.value === "__deleted__"
                  ? !!filters.include_deleted
                  : filters.status === chip.value;
            return (
              <button
                key={chip.value || "all"}
                type="button"
                onClick={() => {
                  if (chip.value === "__unassigned__") {
                    setFilters((prev) => ({
                      ...prev,
                      assignee_email: prev.assignee_email === "__none__" ? "" : "__none__",
                    }));
                    return;
                  }
                  if (chip.value === "__deleted__") {
                    setFilters((prev) => ({ ...prev, status: "", include_deleted: !prev.include_deleted }));
                    return;
                  }
                  setFilters((prev) => ({ ...prev, status: chip.value, include_deleted: false }));
                }}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${
                  selected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-navy"
                }`}
              >
                {chip.label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${selected ? "bg-primary/15" : "bg-muted"}`}>
                  {chip.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filters.q}
            onChange={set("q")}
            placeholder={t("list.search")}
            className="w-full rounded-xl border border-input bg-background py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <select value={filters.category_id} onChange={set("category_id")} className="rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary">
            <option value="">{t("filter.category")}: {t("filter.all")}</option>
            {(options.categories || []).map((category) => (
              <option key={category.id} value={category.id}>{categoryName(category, lang)}</option>
            ))}
          </select>
          <select value={filters.department_id} onChange={set("department_id")} className="rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary">
            <option value="">{t("dist.filterDepartment")}: {t("filter.all")}</option>
            {(options.departments || []).map((department) => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </select>
          <select value={filters.priority} onChange={set("priority")} className="rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary">
            <option value="">{t("filter.priority")}: {t("filter.all")}</option>
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>{t(`prio.${priority}`)}</option>
            ))}
          </select>
          <select value={filters.assignee_email} onChange={set("assignee_email")} className="rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary">
            <option value="">{t("dist.filterAssignee")}: {t("filter.all")}</option>
            <option value="__none__">—</option>
            {(options.users || []).map((user) => (
              <option key={user.email} value={user.email}>
                {user.name}{user.department_name ? ` · ${user.department_name}` : ""}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium text-muted-foreground">
            <span className="whitespace-nowrap">{t("dist.dateFrom")}</span>
            <input type="date" value={filters.date_from} onChange={set("date_from")} className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none" />
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium text-muted-foreground">
            <span className="whitespace-nowrap">{t("dist.dateTo")}</span>
            <input type="date" value={filters.date_to} onChange={set("date_to")} className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none" />
          </label>
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5" /> {t("list.found", { count: data?.total ?? 0 })}
          </span>
          {active ? (
            <button type="button" onClick={() => setFilters(EMPTY)} className="font-semibold text-primary hover:underline">
              {t("filter.reset")}
            </button>
          ) : null}
        </div>
      </section>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.loading")}
        </div>
      ) : data?.items?.length ? (
        <div className="space-y-3">
          {data.items.map((request) => (
            <RequestCard key={request.id} request={request} />
          ))}
        </div>
      ) : (
        <div className="speakup-card px-6 py-16 text-center">
          <p className="font-heading text-base font-semibold text-navy">{t("dist.empty")}</p>
        </div>
      )}
    </div>
  );
}
