import { useI18n } from "@/lib/i18n";
import { STATUS_STYLES } from "@/lib/roles";
import { cn } from "@/lib/utils";

export default function StatusBadge({ value, className }) {
  const { t } = useI18n();
  const style = STATUS_STYLES[value] || "bg-slate-500/10 text-slate-600 border-slate-400/25";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap",
        style,
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {t(`status.${value}`)}
    </span>
  );
}
