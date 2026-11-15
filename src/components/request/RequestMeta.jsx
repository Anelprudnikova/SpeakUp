import { useI18n } from "@/lib/i18n";
import { formatDate } from "@/lib/roles";

export default function RequestMeta({ request }) {
  const { t, lang } = useI18n();
  const rows = [
    { label: t("request.number"), value: request.number || "—", mono: true },
    { label: t("request.type"), value: t(`type.${request.type}`) },
    { label: t("request.category"), value: request.category_names?.[lang] || request.category_names?.ru || "—" },
    { label: t("request.department"), value: request.department_name || "—" },
    { label: t("request.author"), value: request.author_hidden ? t("request.hiddenAuthor") : request.author_name || "—" },
    { label: t("request.created"), value: formatDate(request.created_date, lang) },
    { label: t("request.due"), value: formatDate(request.due_date, lang) },
    { label: t("request.assignee"), value: request.assignee_name || request.assignee_email || "—" },
    { label: t("request.completed"), value: request.completed_date ? formatDate(request.completed_date, lang) : "—" },
  ];

  return (
    <dl className="divide-y divide-border">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-3 py-2.5">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{row.label}</dt>
          <dd className={`text-right text-xs font-semibold text-navy ${row.mono ? "font-mono" : ""}`}>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
