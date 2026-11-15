import { useI18n } from "@/lib/i18n";
import { PRIORITY_STYLES } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";

const ICONS = { low: ArrowDown, medium: ArrowRight, high: ArrowUp };

export default function PriorityBadge({ value, className }) {
  const { t } = useI18n();
  const Icon = ICONS[value] || ArrowRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap",
        PRIORITY_STYLES[value] || PRIORITY_STYLES.medium,
        className
      )}
    >
      <Icon className="h-3 w-3" />
      {t(`prio.${value}`)}
    </span>
  );
}
