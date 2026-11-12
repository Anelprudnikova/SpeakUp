import { Clock } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatDateTime } from "@/lib/roles";

const KNOWN = { status: "status", priority: "prio" };

function labelFor(field, value, t) {
  if (!value) return "";
  const prefix = KNOWN[field];
  if (!prefix) return value;
  const translated = t(`${prefix}.${value}`);
  return translated === `${prefix}.${value}` ? value : translated;
}

export default function HistoryList({ history }) {
  const { t, lang } = useI18n();

  if (!history.length) return <p className="text-sm text-muted-foreground">{t("detail.noHistory")}</p>;

  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      {history.map((entry) => (
        <li key={entry.id} className="relative">
          <span className="absolute -left-[25px] top-1.5 flex h-3 w-3 items-center justify-center rounded-full border-2 border-card bg-primary" />
          <p className="text-xs font-semibold text-navy">{t(`hist.${entry.action}`)}</p>
          {entry.field ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {t(`field.${entry.field}`)}: {labelFor(entry.field, entry.old_value, t) || "—"} → {labelFor(entry.field, entry.new_value, t)}
            </p>
          ) : null}
          {entry.note ? <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{entry.note}</p> : null}
          <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground/80">
            <Clock className="h-3 w-3" />
            {entry.user_name || "—"} · {formatDateTime(entry.created_date, lang)}
          </p>
        </li>
      ))}
    </ol>
  );
}
