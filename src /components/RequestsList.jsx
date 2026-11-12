import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Search } from "lucide-react";
import { listRequests } from "@/lib/speakup-fns";
import { useI18n } from "@/lib/i18n";
import { PRIORITIES, STATUSES, TYPES, categoryName } from "@/lib/roles";
import RequestCard from "./RequestCard";

const EMPTY = { q: "", status: "", priority: "", category_id: "", type: "", sort: "new" };

export default function RequestsList({ scope, headingKey, subKey, showCreate = true, showHeader = true, limit }) {
  const { t, lang } = useI18n();
  const [filters, setFilters] = useState(EMPTY);
  const fetchRequests = useServerFn(listRequests);

  const payload = { ...filters, scope, ...(limit ? { limit } : {}) };
  Object.keys(payload).forEach((k) => {
    if (!payload[k]) delete payload[k];
  });

  const { data, isLoading } = useQuery({
    queryKey: ["requests", payload],
    queryFn: () => fetchRequests({ data: payload }),
  });

  const set = (key) => (event) => setFilters((prev) => ({ ...prev, [key]: event.target.value }));
  const categories = data?.options?.categories || [];
  const activeFilters = Object.values(filters).some((v, i) => i < 5 && v);

  return (
    <div className="space-y-5">
      {showHeader ? (
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold text-navy sm:text-3xl">{t(headingKey)}</h1>
            {subKey ? <p className="mt-1.5 text-sm text-muted-foreground">{t(subKey)}</p> : null}
          </div>
          {showCreate ? (
            <Link
              to="/requests/new"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> {t("nav.newRequest")}
            </Link>
          ) : null}
        </header>
      ) : null}

      <div className="speakup-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={filters.q}
            onChange={set("q")}
            placeholder={t("list.search")}
            className="w-full rounded-xl border border-input bg-background py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <select value={filters.status} onChange={set("status")} className="rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-primary">
            <option value="">{t("filter.status")}: {t("filter.all")}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{t(`status.${s}`)}</option>
            ))}
          </select>
          <select value={filters.category_id} onChange={set("category_id")} className="rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary">
            <option value="">{t("filter.category")}: {t("filter.all")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{categoryName(c, lang)}</option>
            ))}
          </select>
          <select value={filters.priority} onChange={set("priority")} className="rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary">
            <option value="">{t("filter.priority")}: {t("filter.all")}</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{t(`prio.${p}`)}</option>
            ))}
          </select>
          <select value={filters.type} onChange={set("type")} className="rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary">
            <option value="">{t("filter.type")}: {t("filter.all")}</option>
            {TYPES.map((ty) => (
              <option key={ty} value={ty}>{t(`type.${ty}`)}</option>
            ))}
          </select>
          <select value={filters.sort} onChange={set("sort")} className="rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary">
            {["new", "old", "priority", "due", "status"].map((s) => (
              <option key={s} value={s}>{t(`sort.${s}`)}</option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{t("list.found", { count: data?.total ?? 0 })}</span>
          {activeFilters ? (
            <button type="button" onClick={() => setFilters(EMPTY)} className="font-semibold text-primary hover:underline">
              {t("filter.reset")}
            </button>
          ) : null}
        </div>
      </div>

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
          <p className="font-heading text-base font-semibold text-navy">{t("list.empty")}</p>
          <p className="mt-1.5 text-sm text-muted-foreground">{t("list.emptyHint")}</p>
        </div>
      )}
    </div>
  );
}
