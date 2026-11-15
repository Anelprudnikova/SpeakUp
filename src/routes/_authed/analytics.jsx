import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2 } from "lucide-react";
import { getAnalytics } from "@/lib/analytics-fns";
import { useI18n } from "@/lib/i18n";
import { PRIORITIES, STATUSES } from "@/lib/roles";
import StatCard from "@/components/StatCard";

export const Route = createFileRoute("/_authed/analytics")({
  head: () => ({ meta: [{ title: "SpeakUp — Аналитика" }] }),
  component: AnalyticsPage,
});

const COLORS = ["#4263EB", "#7957E8", "#20AFA4", "#F59E0B", "#64748B", "#EF4444", "#94A3B8"];

function AnalyticsPage() {
  const { t, lang } = useI18n();
  const fetchAnalytics = useServerFn(getAnalytics);
  const [filters, setFilters] = useState({ months: 6, department_id: "", category_id: "", priority: "" });
  const payload = { months: filters.months };
  if (filters.department_id) payload.department_id = filters.department_id;
  if (filters.category_id) payload.category_id = filters.category_id;
  if (filters.priority) payload.priority = filters.priority;

  const { data, isLoading } = useQuery({
    queryKey: ["analytics", payload],
    queryFn: () => fetchAnalytics({ data: payload }),
  });

  const monthLabel = (key) => {
    const [year, month] = key.split("-");
    const locale = lang === "kk" ? "kk-KZ" : lang === "en" ? "en-GB" : "ru-RU";
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString(locale, { month: "short" });
  };

  const statusData = STATUSES.map((s, index) => ({
    name: t(`status.${s}`),
    value: data?.counts?.[s] ?? 0,
    color: COLORS[index % COLORS.length],
  })).filter((row) => row.value > 0);

  const categoryData = (data?.byCategory || []).slice(0, 6).map((row) => ({
    name: row.names?.[lang] || row.names?.ru || "—",
    value: row.value,
  }));

  const departmentData = (data?.byDepartment || []).slice(0, 6);

  const monthlyData = (data?.monthly || []).map((row) => ({
    name: monthLabel(row.month),
    [t("analytics.created")]: row.created,
    [t("analytics.closed")]: row.closed,
  }));

  const priorityData = PRIORITIES.map((p) => ({ name: t(`prio.${p}`), value: data?.byPriority?.[p] ?? 0 }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("common.loading")}
      </div>
    );
  }

  const quality = data?.quality || {};

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-navy sm:text-3xl">{t("analytics.heading")}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{t("analytics.sub")}</p>
        </div>
      </header>

      <div className="speakup-card grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4">
        <select
          value={filters.department_id}
          onChange={(e) => setFilters((p) => ({ ...p, department_id: e.target.value }))}
          className="rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary"
        >
          <option value="">{t("admin.department")}: {t("filter.all")}</option>
          {(data?.options?.departments || []).map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <select
          value={filters.category_id}
          onChange={(e) => setFilters((p) => ({ ...p, category_id: e.target.value }))}
          className="rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary"
        >
          <option value="">{t("filter.category")}: {t("filter.all")}</option>
          {(data?.options?.categories || []).map((c) => (
            <option key={c.id} value={c.id}>{c[`name_${lang}`] || c.name_ru}</option>
          ))}
        </select>
        <select
          value={filters.priority}
          onChange={(e) => setFilters((p) => ({ ...p, priority: e.target.value }))}
          className="rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary"
        >
          <option value="">{t("filter.priority")}: {t("filter.all")}</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{t(`prio.${p}`)}</option>
          ))}
        </select>
        <select
          value={filters.months}
          onChange={(e) => setFilters((p) => ({ ...p, months: Number(e.target.value) }))}
          className="rounded-xl border border-input bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary"
        >
          {[3, 6, 9, 12].map((m) => (
            <option key={m} value={m}>{t("analytics.months", { n: m })}</option>
          ))}
        </select>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t("analytics.total")} value={data?.counts?.total ?? 0} tone="primary" />
        <StatCard label={t("analytics.new")} value={data?.counts?.new ?? 0} tone="violet" />
        <StatCard label={t("analytics.inProgress")} value={data?.counts?.inProgress ?? 0} tone="amber" />
        <StatCard label={t("analytics.implemented")} value={data?.counts?.implemented ?? 0} tone="teal" />
        <StatCard label={t("analytics.review")} value={data?.counts?.review ?? 0} tone="violet" />
        <StatCard label={t("analytics.rejected")} value={data?.counts?.rejected ?? 0} tone="muted" />
        <StatCard label={t("analytics.overdue")} value={data?.counts?.overdue ?? 0} tone="amber" />
        <StatCard
          label={t("analytics.resolvedRate")}
          value={data?.counts?.resolvedRate === null ? "—" : `${data?.counts?.resolvedRate ?? 0}%`}
          tone="teal"
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title={t("analytics.dynamics")}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey={t("analytics.created")} fill="#4263EB" radius={[6, 6, 0, 0]} />
              <Bar dataKey={t("analytics.closed")} fill="#20AFA4" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t("analytics.byStatus")}>
          {statusData.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={2}>
                  {statusData.map((row) => (
                    <Cell key={row.name} fill={row.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <Empty />
          )}
        </ChartCard>

        <ChartCard title={t("analytics.byCategory")}>
          {categoryData.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={categoryData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }} />
                <Bar dataKey="value" fill="#7957E8" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Empty />
          )}
        </ChartCard>

        <ChartCard title={t("analytics.byDepartment")}>
          {departmentData.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={departmentData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }} />
                <Bar dataKey="value" fill="#4263EB" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Empty />
          )}
        </ChartCard>

        <ChartCard title={t("analytics.byPriority")}>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={priorityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748B" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }} />
              <Bar dataKey="value" fill="#20AFA4" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t("analytics.quality")}>
          <div className="grid grid-cols-2 gap-3">
            <Metric label={t("analytics.avgFirstResponse")} value={quality.avgFirstResponseHours} suffix={t("analytics.hours")} />
            <Metric label={t("analytics.avgResolution")} value={quality.avgResolutionDays} suffix={t("common.days")} />
            <Metric label={t("analytics.onTime")} value={quality.onTimeRate} suffix="%" />
            <Metric label={t("analytics.clarifications")} value={quality.clarificationReturns} />
            <Metric label={t("analytics.recurring")} value={quality.recurringIssues} />
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <section className="speakup-card p-5">
      <h2 className="mb-3 font-heading text-sm font-semibold text-navy">{title}</h2>
      {children}
    </section>
  );
}

function Metric({ label, value, suffix }) {
  const { t } = useI18n();
  return (
    <div className="rounded-xl bg-muted/60 p-3">
      <p className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1.5 font-heading text-lg font-semibold text-navy">
        {value === null || value === undefined ? <span className="text-[11px] font-medium text-muted-foreground">{t("analytics.noData")}</span> : `${value}${suffix ? ` ${suffix}` : ""}`}
      </p>
    </div>
  );
}

function Empty() {
  const { t } = useI18n();
  return <p className="py-16 text-center text-sm text-muted-foreground">{t("analytics.noData")}</p>;
}
